import { buildRecruiterDynamicVariables } from "@/lib/retell/buildRecruiterDynamicVariables";
import { retellCreatePhoneCall } from "@/lib/retell/retellClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isE164(value: string) {
  return /^\+[1-9]\d{1,14}$/.test(value);
}

function nowIso() {
  return new Date().toISOString();
}

function pickFirstQuestion(selectedQuestions: string[], customQuestions: string[]) {
  const all = [...selectedQuestions, ...customQuestions].map((q) => q.trim()).filter(Boolean);
  return all[0] ?? null;
}

function buildBeginMessage(input: {
  candidateName: string | null;
  companyName: string | null;
  jobTitle: string | null;
  firstQuestion: string | null;
}) {
  const name = input.candidateName?.trim() ? input.candidateName.trim() : null;
  const company = input.companyName?.trim() ? input.companyName.trim() : null;
  const job = input.jobTitle?.trim() ? input.jobTitle.trim() : null;
  const firstQ = input.firstQuestion?.trim() ? input.firstQuestion.trim() : null;

  const greeting = name ? `Hi ${name},` : "Hi there,";

  let intro = "this is an AI recruiting assistant";
  if (company) intro += ` calling from ${company}`;
  if (job) intro += ` about a ${job} opportunity`;
  else intro += " about an open role";
  intro += ".";

  const purpose = "We’re reaching out to share a quick overview and ask a few screening questions—no pressure.";
  const consent = "Do you have a few minutes to chat now?";
  const q = firstQ ? `If now works, I’ll start with the first question: ${firstQ}` : null;

  return [greeting, intro, purpose, consent, q].filter(Boolean).join(" ");
}

export type StartNextCallResult =
  | { started: true; candidateRowId: string; retellCallId: string; retellCallStatus: string | null }
  | {
      started: false;
      reason:
        | "already_calling"
        | "no_queued_candidates"
        | "paused_or_stopped"
        | "no_active_session"
        | "retell_failed"
        | "not_retryable";
    };

export async function startCallForCandidateRow(opts: {
  campaignId: string;
  sessionId: string;
  candidateRowId: string;
  allowStatuses?: string[];
  userId?: string;
}): Promise<StartNextCallResult> {
  const supabase = await createSupabaseServerClient();
  const { campaignId, sessionId, candidateRowId, allowStatuses = ["queued", "retry_scheduled", "callback_scheduled"], userId } = opts;

  // Safety: never run concurrent outbound calls for a session.
  let activeCountQuery = supabase
    .from("campaign_call_candidates")
    .select("id", { count: "exact", head: true })
    .eq("call_session_id", sessionId)
    .in("call_status", ["calling", "running", "in_progress"]);
  if (userId) activeCountQuery = activeCountQuery.eq("user_id", userId);
  const { count: activeCount, error: activeCountError } = await activeCountQuery;
  if (activeCountError) return { started: false, reason: "retell_failed" };
  if (Number(activeCount ?? 0) > 0) return { started: false, reason: "already_calling" };

  let sessionLoadQuery = supabase
    .from("campaign_call_sessions")
    .select("id,status")
    .eq("id", sessionId);
  if (userId) sessionLoadQuery = sessionLoadQuery.eq("user_id", userId);
  const { data: sessionRow, error: sessionLoadError } = await sessionLoadQuery.maybeSingle();
  if (sessionLoadError) return { started: false, reason: "retell_failed" };
  if (!sessionRow?.id) return { started: false, reason: "no_active_session" };

  const sessionStatus = String(sessionRow.status ?? "").toLowerCase();
  if (sessionStatus.startsWith("paused") || sessionStatus === "stopped" || sessionStatus === "completed") {
    return { started: false, reason: "paused_or_stopped" };
  }

  let campaignLoadQuery = supabase
    .from("campaigns")
    .select("campaign_name,job_title,job_description,employment_type,required_skills")
    .eq("id", campaignId);
  if (userId) campaignLoadQuery = campaignLoadQuery.eq("user_id", userId);
  const { data: campaignRow, error: campaignLoadError } = await campaignLoadQuery.maybeSingle();
  if (campaignLoadError) return { started: false, reason: "retell_failed" };

  let callConfigQuery = supabase
    .from("call_configurations")
    .select("company_name,selected_questions,custom_questions,call_notes")
    .eq("campaign_id", campaignId);
  if (userId) callConfigQuery = callConfigQuery.eq("user_id", userId);
  const { data: callConfigRow } = await callConfigQuery.maybeSingle();

  const companyName = String(callConfigRow?.company_name ?? "").trim() || null;
  const selectedQuestions = Array.isArray(callConfigRow?.selected_questions)
    ? callConfigRow?.selected_questions.map((q: unknown) => String(q ?? "").trim()).filter(Boolean)
    : [];
  const customQuestions = Array.isArray(callConfigRow?.custom_questions)
    ? callConfigRow?.custom_questions.map((q: unknown) => String(q ?? "").trim()).filter(Boolean)
    : [];
  const callNotes = String(callConfigRow?.call_notes ?? "").trim() || null;

  let candidateLoadQuery = supabase
    .from("campaign_call_candidates")
    .select("id,user_id,candidate_id,candidate_name,candidate_phone,attempt_count,max_attempts,call_status")
    .eq("id", candidateRowId);
  if (userId) candidateLoadQuery = candidateLoadQuery.eq("user_id", userId);
  const { data: candidate, error: candidateError } = await candidateLoadQuery.maybeSingle();
  if (candidateError) return { started: false, reason: "retell_failed" };
  if (!candidate?.id) return { started: false, reason: "no_queued_candidates" };

  const currentStatus = String((candidate as { call_status?: unknown }).call_status ?? "");
  if (!allowStatuses.includes(currentStatus)) return { started: false, reason: "not_retryable" };

  const rawPhone = String((candidate as { candidate_phone?: unknown }).candidate_phone ?? "").trim();
  const candidateName = String((candidate as { candidate_name?: unknown }).candidate_name ?? "").trim() || null;
  const attemptCount = Number((candidate as { attempt_count?: unknown }).attempt_count ?? 0);
  const maxAttempts = Number((candidate as { max_attempts?: unknown }).max_attempts ?? 3);
  const attemptAt = nowIso();
  const effectiveUserId = String((candidate as { user_id?: unknown }).user_id ?? "").trim() || userId || "";

  if (attemptCount >= maxAttempts) return { started: false, reason: "not_retryable" };

  // Credits enforcement: do not start additional billable calls when balance is exhausted.
  if (effectiveUserId) {
    const { data: creditsRow, error: creditsError } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", effectiveUserId)
      .maybeSingle();
    if (creditsError) return { started: false, reason: "retell_failed" };
    const balance = Number((creditsRow as { balance?: unknown } | null)?.balance ?? 0);
    if (balance <= 0) {
      const now = nowIso();
      await Promise.all([
        supabase.from("campaign_call_sessions").update({ status: "paused_credits", updated_at: now }).eq("id", sessionId),
        supabase.from("campaigns").update({ status: "Paused", updated_at: now }).eq("id", campaignId),
      ]);
      return { started: false, reason: "paused_or_stopped" };
    }
  }

  if (!rawPhone || !isE164(rawPhone)) {
    const message = rawPhone ? `Invalid phone number (expected E.164): ${rawPhone}` : "Missing phone number";
    let invalidPhoneUpdate = supabase
      .from("campaign_call_candidates")
      .update({
        call_status: "failed",
        last_error: message,
        retell_call_status: null,
        attempt_count: attemptCount + 1,
        last_attempt_at: attemptAt,
        call_completed_at: attemptAt,
        updated_at: attemptAt,
      })
      .eq("id", candidateRowId);
    if (userId) invalidPhoneUpdate = invalidPhoneUpdate.eq("user_id", userId);
    await invalidPhoneUpdate;
    return { started: false, reason: "retell_failed" };
  }

  // Mark "calling" first to reduce double-dial risk.
  const preMarkAt = nowIso();
  let preMarkQuery = supabase
    .from("campaign_call_candidates")
    .update({
      call_status: "calling",
      last_error: null,
      retry_reason: null,
      next_retry_at: null,
      attempt_count: attemptCount + 1,
      last_attempt_at: preMarkAt,
      call_started_at: preMarkAt,
      updated_at: preMarkAt,
    })
    .eq("id", candidateRowId)
    .in("call_status", allowStatuses)
    .select("id");
  if (userId) preMarkQuery = preMarkQuery.eq("user_id", userId);
  const { data: preMarked, error: preMarkError } = await preMarkQuery;

  if (preMarkError) return { started: false, reason: "retell_failed" };
  if (!preMarked?.length) return { started: false, reason: "already_calling" };

  try {
    const fromNumber = process.env.RETELL_PHONE_NUMBER;
    const overrideAgentId = process.env.RETELL_AGENT_ID;
    if (!fromNumber) throw new Error("Missing RETELL_PHONE_NUMBER.");
    if (!overrideAgentId) throw new Error("Missing RETELL_AGENT_ID.");

    const webhookUrl = process.env.RETELL_WEBHOOK_URL ?? null;
    if (webhookUrl) {
      console.log("[outreach] retell webhook override enabled", { webhook_url: webhookUrl });
    } else {
      console.log("[outreach] retell webhook override not set");
    }

    const jobTitle = campaignRow ? String((campaignRow as { job_title?: unknown }).job_title ?? "").trim() || null : null;
    const firstQuestion = pickFirstQuestion(selectedQuestions, customQuestions);
    const beginMessage = buildBeginMessage({ candidateName, companyName, jobTitle, firstQuestion });

    const dynamicVars = buildRecruiterDynamicVariables({
      campaignName: campaignRow ? String((campaignRow as { campaign_name?: unknown }).campaign_name ?? "").trim() || null : null,
      jobTitle,
      jobDescription: campaignRow ? String((campaignRow as { job_description?: unknown }).job_description ?? "").trim() || null : null,
      employmentType: campaignRow ? String((campaignRow as { employment_type?: unknown }).employment_type ?? "").trim() || null : null,
      requiredSkills: campaignRow ? String((campaignRow as { required_skills?: unknown }).required_skills ?? "").trim() || null : null,
      companyName,
      selectedQuestions,
      customQuestions,
      callNotes,
      candidateName,
    });

    const retellRes = await retellCreatePhoneCall({
      from_number: fromNumber,
      to_number: rawPhone,
      override_agent_id: overrideAgentId,
      retell_llm_dynamic_variables: dynamicVars,
      agent_override: {
        retell_llm: {
          begin_message: beginMessage,
        },
        // Optional per-call webhook override to ensure call events reach the correct environment.
        // If unset, Retell will use the agent/account configured webhook.
        webhook_url: webhookUrl,
        webhook_events: webhookUrl
          ? ["call_started", "call_ended", "call_analyzed", "transcript_updated"]
          : null,
      },
      metadata: {
        campaign_id: campaignId,
        call_session_id: sessionId,
        campaign_call_candidate_id: candidateRowId,
        candidate_id: String((candidate as { candidate_id?: unknown }).candidate_id ?? ""),
      },
    });

    const afterAt = nowIso();
    const updateCandidateAfterCall = userId
      ? supabase
          .from("campaign_call_candidates")
          .update({
            retell_call_id: String(retellRes.call_id),
            retell_call_status: String(retellRes.call_status ?? "registered"),
            last_error: null,
            updated_at: afterAt,
          })
          .eq("id", candidateRowId)
          .eq("user_id", userId)
      : supabase
          .from("campaign_call_candidates")
          .update({
            retell_call_id: String(retellRes.call_id),
            retell_call_status: String(retellRes.call_status ?? "registered"),
            last_error: null,
            updated_at: afterAt,
          })
          .eq("id", candidateRowId);

    const updateSessionAfterCall = userId
      ? supabase.from("campaign_call_sessions").update({ status: "running", updated_at: afterAt }).eq("id", sessionId).eq("user_id", userId)
      : supabase.from("campaign_call_sessions").update({ status: "running", updated_at: afterAt }).eq("id", sessionId);

    await Promise.all([
      updateCandidateAfterCall,
      updateSessionAfterCall,
    ]);

    return { started: true, candidateRowId, retellCallId: String(retellRes.call_id), retellCallStatus: String(retellRes.call_status ?? "") || null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Retell call failed.";
    const failAt = nowIso();
    let failUpdateQuery = supabase
      .from("campaign_call_candidates")
      .update({
        call_status: "failed",
        retell_call_status: "error",
        last_error: message,
        call_completed_at: failAt,
        updated_at: failAt,
      })
      .eq("id", candidateRowId);
    if (userId) failUpdateQuery = failUpdateQuery.eq("user_id", userId);
    await failUpdateQuery;
    return { started: false, reason: "retell_failed" };
  }
}

export async function startNextQueuedCall(opts: { campaignId: string; sessionId: string; userId?: string }): Promise<StartNextCallResult> {
  const supabase = await createSupabaseServerClient();
  const { campaignId, sessionId, userId } = opts;

  // Safety: never run concurrent outbound calls for a session.
  let activeCountQuery = supabase
    .from("campaign_call_candidates")
    .select("id", { count: "exact", head: true })
    .eq("call_session_id", sessionId)
    .in("call_status", ["calling", "running", "in_progress"]);
  if (userId) activeCountQuery = activeCountQuery.eq("user_id", userId);
  const { count: activeCount, error: activeCountError } = await activeCountQuery;

  if (activeCountError) return { started: false, reason: "retell_failed" };
  if (Number(activeCount ?? 0) > 0) return { started: false, reason: "already_calling" };

  let sessionLoadQuery = supabase
    .from("campaign_call_sessions")
    .select("id,status")
    .eq("id", sessionId);
  if (userId) sessionLoadQuery = sessionLoadQuery.eq("user_id", userId);
  const { data: sessionRow, error: sessionLoadError } = await sessionLoadQuery.maybeSingle();

  if (sessionLoadError) return { started: false, reason: "retell_failed" };
  if (!sessionRow?.id) return { started: false, reason: "no_active_session" };

  const sessionStatus = String(sessionRow.status ?? "").toLowerCase();
  if (sessionStatus.startsWith("paused") || sessionStatus === "stopped" || sessionStatus === "completed") {
    return { started: false, reason: "paused_or_stopped" };
  }

  for (let i = 0; i < 25; i += 1) {
    let queuedQuery = supabase
      .from("campaign_call_candidates")
      .select("id,candidate_id,candidate_name,candidate_phone,attempt_count,created_at")
      .eq("call_session_id", sessionId)
      .eq("call_status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      ;
    if (userId) queuedQuery = queuedQuery.eq("user_id", userId);
    const { data: queued, error: queuedError } = await queuedQuery.maybeSingle();

    if (queuedError) return { started: false, reason: "retell_failed" };
    if (!queued?.id) return { started: false, reason: "no_queued_candidates" };

    const candidateRowId = String(queued.id);
    const started = await startCallForCandidateRow({ campaignId, sessionId, candidateRowId, allowStatuses: ["queued"], userId });
    if (started.started) return started;
    if (started.reason === "already_calling") return started;
    if (started.reason === "paused_or_stopped") return started;
    if (started.reason === "retell_failed") return started;
    // If candidate was invalid phone, helper marked failed; continue loop to try next queued.
    continue;
  }

  return { started: false, reason: "no_queued_candidates" };
}

