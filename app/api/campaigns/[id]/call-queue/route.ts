import { supabase } from "@/lib/supabaseClient";
import { buildRecruiterDynamicVariables } from "@/lib/retell/buildRecruiterDynamicVariables";
import { retellCreatePhoneCall } from "@/lib/retell/retellClient";
import { NextResponse } from "next/server";

type CallSessionStatus = "queued" | "running" | "completed" | "failed" | string;

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isE164(value: string) {
  return /^\+[1-9]\d{1,14}$/.test(value);
}

function nowIso() {
  return new Date().toISOString();
}

type StartFirstCallResult =
  | { started: true; candidateRowId: string; retellCallId: string; retellCallStatus: string | null }
  | { started: false; reason: "already_calling" | "no_queued_candidates" | "paused_or_stopped" | "no_active_session" | "retell_failed" };

async function startFirstQueuedCall(opts: {
  campaignId: string;
  sessionId: string;
}): Promise<StartFirstCallResult> {
  const { campaignId, sessionId } = opts;

  // MVP safety: never run concurrent outbound calls for a session.
  const { count: activeCount, error: activeCountError } = await supabase
    .from("campaign_call_candidates")
    .select("id", { count: "exact", head: true })
    .eq("call_session_id", sessionId)
    .in("call_status", ["calling", "running", "in_progress"]);

  if (activeCountError) {
    // Treat as "don't start" rather than risking duplicates.
    return { started: false, reason: "retell_failed" };
  }
  if (Number(activeCount ?? 0) > 0) return { started: false, reason: "already_calling" };

  const { data: sessionRow, error: sessionLoadError } = await supabase
    .from("campaign_call_sessions")
    .select("id,status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionLoadError) return { started: false, reason: "retell_failed" };
  if (!sessionRow?.id) return { started: false, reason: "no_active_session" };

  const sessionStatus = String(sessionRow.status ?? "").toLowerCase();
  if (sessionStatus === "paused" || sessionStatus === "stopped") return { started: false, reason: "paused_or_stopped" };

  const { data: campaignRow, error: campaignLoadError } = await supabase
    .from("campaigns")
    .select("campaign_name,job_title,job_description,employment_type,required_skills")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignLoadError) return { started: false, reason: "retell_failed" };

  const { data: callConfigRow, error: callConfigError } = await supabase
    .from("call_configurations")
    .select("company_name,selected_questions,custom_questions,call_notes")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  // Call configuration is expected, but a missing row shouldn't crash the queue.
  if (callConfigError) {
    // Non-fatal; continue with best-effort blank config.
  }

  const companyName = String(callConfigRow?.company_name ?? "").trim() || null;
  const selectedQuestions = Array.isArray(callConfigRow?.selected_questions)
    ? callConfigRow?.selected_questions.map((q: unknown) => String(q ?? "").trim()).filter(Boolean)
    : [];
  const customQuestions = Array.isArray(callConfigRow?.custom_questions)
    ? callConfigRow?.custom_questions.map((q: unknown) => String(q ?? "").trim()).filter(Boolean)
    : [];
  const callNotes = String(callConfigRow?.call_notes ?? "").trim() || null;

  // Find the first callable queued candidate. If the first queued candidate has an invalid phone,
  // record an error and advance to the next row (still only starting ONE call total).
  for (let i = 0; i < 25; i += 1) {
    const { data: queued, error: queuedError } = await supabase
      .from("campaign_call_candidates")
      .select("id,candidate_id,candidate_name,candidate_phone,attempt_count")
      .eq("call_session_id", sessionId)
      .eq("call_status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (queuedError) return { started: false, reason: "retell_failed" };
    if (!queued?.id) return { started: false, reason: "no_queued_candidates" };

    const candidateRowId = String(queued.id);
    const candidateName = String(queued.candidate_name ?? "").trim() || null;
    const rawPhone = String(queued.candidate_phone ?? "").trim();

    const attemptCount = Number((queued as { attempt_count?: unknown }).attempt_count ?? 0);
    const attemptAt = nowIso();

    if (!rawPhone || !isE164(rawPhone)) {
      const message = rawPhone ? `Invalid phone number (expected E.164): ${rawPhone}` : "Missing phone number";
      await supabase
        .from("campaign_call_candidates")
        .update({
          call_status: "failed",
          last_error: message,
          retell_call_status: null,
          attempt_count: attemptCount + 1,
          last_attempt_at: attemptAt,
          updated_at: attemptAt,
        })
        .eq("id", candidateRowId);
      // Continue to the next queued candidate (still only starting one real call).
      continue;
    }

    // Mark "calling" first to reduce double-dial risk; if we fail later, we will flip to failed.
    const preMarkAt = nowIso();
    const { data: updatedRows, error: preMarkError } = await supabase
      .from("campaign_call_candidates")
      .update({
        call_status: "calling",
        last_error: null,
        attempt_count: attemptCount + 1,
        last_attempt_at: preMarkAt,
        call_started_at: preMarkAt,
        updated_at: preMarkAt,
      })
      .eq("id", candidateRowId)
      .eq("call_status", "queued")
      .select("id")
      .maybeSingle();

    if (preMarkError || !updatedRows?.id) {
      // Another process likely raced; don't attempt a call.
      return { started: false, reason: "already_calling" };
    }

    try {
      const fromNumber = process.env.RETELL_PHONE_NUMBER;
      const overrideAgentId = process.env.RETELL_AGENT_ID;
      if (!fromNumber) throw new Error("Missing RETELL_PHONE_NUMBER.");
      if (!overrideAgentId) throw new Error("Missing RETELL_AGENT_ID.");

      const dynamicVars = buildRecruiterDynamicVariables({
        campaignName: campaignRow ? String((campaignRow as { campaign_name?: unknown }).campaign_name ?? "").trim() || null : null,
        jobTitle: campaignRow ? String((campaignRow as { job_title?: unknown }).job_title ?? "").trim() || null : null,
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
        metadata: {
          campaign_id: campaignId,
          call_session_id: sessionId,
          campaign_call_candidate_id: candidateRowId,
          candidate_id: String(queued.candidate_id ?? ""),
        },
      });

      const afterAt = nowIso();
      await Promise.all([
        supabase
          .from("campaign_call_candidates")
          .update({
            retell_call_id: String(retellRes.call_id),
            retell_call_status: String(retellRes.call_status ?? "registered"),
            last_error: null,
            updated_at: afterAt,
          })
          .eq("id", candidateRowId),
        supabase
          .from("campaign_call_sessions")
          .update({ status: "running", updated_at: afterAt })
          .eq("id", sessionId),
      ]);

      return {
        started: true,
        candidateRowId,
        retellCallId: String(retellRes.call_id),
        retellCallStatus: retellRes.call_status ? String(retellRes.call_status) : null,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Retell call failed.";
      const failAt = nowIso();
      await supabase
        .from("campaign_call_candidates")
        .update({
          call_status: "failed",
          retell_call_status: "error",
          last_error: message,
          updated_at: failAt,
        })
        .eq("id", candidateRowId);
      return { started: false, reason: "retell_failed" };
    }
  }

  return { started: false, reason: "no_queued_candidates" };
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,status")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 });
  }
  if (!campaign?.id) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  if (String(campaign.status ?? "") !== "Ready") {
    return NextResponse.json({ error: "Campaign must be Ready before starting calls." }, { status: 409 });
  }

  const activeStatuses: CallSessionStatus[] = ["queued", "running"];
  const { data: existingSession, error: existingError } = await supabase
    .from("campaign_call_sessions")
    .select("id,status,total_candidates,started_at,created_at")
    .eq("campaign_id", campaignId)
    .in("status", activeStatuses)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingSession?.id) {
    const now = nowIso();
    const { error: updateCampaignError } = await supabase
      .from("campaigns")
      .update({ status: "Calling", updated_at: now })
      .eq("id", campaignId);
    if (updateCampaignError) {
      return NextResponse.json({ error: updateCampaignError.message }, { status: 500 });
    }

    const sessionId = String(existingSession.id);
    const callStart = await startFirstQueuedCall({ campaignId, sessionId });
    return NextResponse.json(
      {
        sessionId,
        created: false,
        call: callStart,
      },
      { status: callStart.started ? 200 : 202 },
    );
  }

  const { data: attachedLinks, error: attachedError } = await supabase
    .from("campaign_candidate_lists")
    .select("list_id")
    .eq("campaign_id", campaignId);

  if (attachedError) {
    return NextResponse.json({ error: attachedError.message }, { status: 500 });
  }

  const listIds = (attachedLinks ?? []).map((r) => String(r.list_id)).filter(Boolean);
  if (!listIds.length) {
    return NextResponse.json({ error: "No candidate lists attached to this campaign." }, { status: 400 });
  }

  const { data: candidatesData, error: candidatesError } = await supabase
    .from("candidates")
    .select("id,name,phone,email,list_id")
    .in("list_id", listIds);

  if (candidatesError) {
    return NextResponse.json({ error: candidatesError.message }, { status: 500 });
  }

  const candidates = (candidatesData ?? []).map((c) => ({
    id: String(c.id),
    name: String(c.name ?? ""),
    phone: String(c.phone ?? ""),
    email: String(c.email ?? ""),
  }));

  if (!candidates.length) {
    return NextResponse.json({ error: "No candidates found in the attached lists." }, { status: 400 });
  }

  const now = nowIso();

  const { data: createdSession, error: createSessionError } = await supabase
    .from("campaign_call_sessions")
    .insert({
      campaign_id: campaignId,
      status: "queued",
      total_candidates: candidates.length,
      started_at: now,
    })
    .select("id")
    .single();

  if (createSessionError) {
    return NextResponse.json({ error: createSessionError.message }, { status: 500 });
  }

  const callSessionId = String(createdSession.id);
  const callCandidateRows = candidates.map((c) => ({
    call_session_id: callSessionId,
    campaign_id: campaignId,
    candidate_id: c.id,
    candidate_name: c.name,
    candidate_phone: c.phone,
    candidate_email: c.email,
    call_status: "queued",
  }));

  for (const batch of chunk(callCandidateRows, 500)) {
    const { error: insertError } = await supabase.from("campaign_call_candidates").insert(batch);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const { error: updateCampaignError } = await supabase
    .from("campaigns")
    .update({ status: "Calling", updated_at: now })
    .eq("id", campaignId);

  if (updateCampaignError) {
    return NextResponse.json({ error: updateCampaignError.message }, { status: 500 });
  }

  const callStart = await startFirstQueuedCall({ campaignId, sessionId: callSessionId });
  return NextResponse.json(
    {
      sessionId: callSessionId,
      created: true,
      call: callStart,
    },
    { status: callStart.started ? 201 : 202 },
  );
}

