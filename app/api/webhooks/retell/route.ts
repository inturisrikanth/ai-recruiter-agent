import { supabase } from "@/lib/supabaseClient";
import { startNextQueuedCall } from "@/lib/outreach/startNextQueuedCall";
import { verifyRetellWebhookSignature } from "@/lib/retell/verifyWebhookSignature";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

type RetellWebhookPayload = {
  event?: unknown;
  call?: unknown;
};

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function msToIso(ms: unknown) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n).toISOString();
}

function pickString(value: unknown) {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

function getInVoicemail(call: Record<string, unknown>) {
  return (
    Boolean((call as { in_voicemail?: unknown }).in_voicemail) ||
    Boolean((call as { call_analysis?: { in_voicemail?: unknown } }).call_analysis?.in_voicemail) ||
    Boolean((call as { post_call_analysis?: { in_voicemail?: unknown } }).post_call_analysis?.in_voicemail)
  );
}

function getCallSuccessful(call: Record<string, unknown>) {
  const direct = (call as { call_successful?: unknown }).call_successful;
  const nested =
    (call as { call_analysis?: { call_successful?: unknown } }).call_analysis?.call_successful ??
    (call as { post_call_analysis?: { call_successful?: unknown } }).post_call_analysis?.call_successful;
  if (typeof (direct ?? nested) === "boolean") return Boolean(direct ?? nested);
  return null;
}

function getDurationMs(call: Record<string, unknown>) {
  const n = Number((call as { duration_ms?: unknown }).duration_ms);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function countSpeakerTaggedLines(text: string) {
  let user = 0;
  let agent = 0;
  let total = 0;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m1 = line.match(/^\s*(?:\[([^\]]+)\]|([^:>-]{1,24}))\s*(?::|->|-)\s*/i);
    const m2 = line.match(/^\s*(user|callee|candidate|human|customer|agent|assistant)\s*[:>-]\s*/i);
    const rawTag = String(m1?.[1] ?? m1?.[2] ?? m2?.[1] ?? "")
      .trim()
      .toLowerCase();
    if (!rawTag) continue;

    total += 1;
    if (["agent", "assistant", "ai"].includes(rawTag)) agent += 1;
    else if (["user", "callee", "candidate", "human", "customer"].includes(rawTag)) user += 1;
  }

  return { user, agent, total };
}

function getUserUtteranceCounts(call: Record<string, unknown>) {
  let user = 0;
  let agent = 0;
  let total = 0;

  const arrays: unknown[] = [
    (call as { transcript_object?: unknown }).transcript_object,
    (call as { transcript_with_tool_calls?: unknown }).transcript_with_tool_calls,
  ];

  for (const a of arrays) {
    if (!Array.isArray(a)) continue;
    for (const item of a) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const speaker = String(obj.speaker ?? obj.role ?? obj.from ?? "").toLowerCase();
      const text = String(obj.text ?? obj.content ?? obj.utterance ?? "").trim();
      if (!text) continue;
      total += 1;
      if (speaker === "agent" || speaker === "assistant") agent += 1;
      else if (speaker === "user" || speaker === "callee" || speaker === "human" || speaker === "customer" || speaker === "candidate") {
        user += 1;
      }
    }
  }

  // Fallback: plain transcript string. Retell often includes speaker-tagged lines (e.g. "User: ...", "Agent: ...").
  const transcriptTextCandidates: unknown[] = [
    (call as { transcript?: unknown }).transcript,
    (call as { transcript_text?: unknown }).transcript_text,
    (call as { transcript_raw?: unknown }).transcript_raw,
  ];
  for (const t of transcriptTextCandidates) {
    if (typeof t !== "string") continue;
    const counts = countSpeakerTaggedLines(t);
    user += counts.user;
    agent += counts.agent;
    total += counts.total;
  }

  // Some Retell payloads include post-call analysis utterance counts.
  const analysisUserCount =
    (call as { call_analysis?: { user_utterance_count?: unknown } }).call_analysis?.user_utterance_count ??
    (call as { post_call_analysis?: { user_utterance_count?: unknown } }).post_call_analysis?.user_utterance_count ??
    (call as { post_call_analysis_data?: { user_utterance_count?: unknown } }).post_call_analysis_data?.user_utterance_count;
  const analysisAgentCount =
    (call as { call_analysis?: { agent_utterance_count?: unknown } }).call_analysis?.agent_utterance_count ??
    (call as { post_call_analysis?: { agent_utterance_count?: unknown } }).post_call_analysis?.agent_utterance_count ??
    (call as { post_call_analysis_data?: { agent_utterance_count?: unknown } }).post_call_analysis_data?.agent_utterance_count;

  const userHint = Number(analysisUserCount);
  const agentHint = Number(analysisAgentCount);
  if (Number.isFinite(userHint) && userHint > 0) user = Math.max(user, userHint);
  if (Number.isFinite(agentHint) && agentHint > 0) agent = Math.max(agent, agentHint);

  return { user, agent, total };
}

function isNoAnswerLikeDisconnection(reason: string) {
  const r = reason.toLowerCase();
  return (
    r.includes("voicemail") ||
    r.includes("dial_no_answer") ||
    r.includes("dial-no-answer") ||
    r.includes("dial_busy") ||
    r.includes("busy") ||
    r.includes("no_answer") ||
    r.includes("no-answer") ||
    r.includes("not_connected") ||
    r.includes("user_declined") ||
    r.includes("declined") ||
    r.includes("rejected")
  );
}

type NoAnswerKind = "voicemail" | "call_rejected" | "no_answer" | null;

function deriveNoAnswerKind(opts: {
  call: Record<string, unknown>;
  disconnectionReasonRaw: string | null;
  failureReasonRaw: string | null;
}): { kind: NoAnswerKind } {
  const { call, disconnectionReasonRaw, failureReasonRaw } = opts;
  const inVoicemail = getInVoicemail(call);
  const a = (disconnectionReasonRaw ?? "").toLowerCase();
  const b = (failureReasonRaw ?? "").toLowerCase();
  const combined = [a, b].filter(Boolean).join(" | ");

  const voicemail =
    inVoicemail ||
    combined.includes("voicemail_reached") ||
    combined.includes("voicemail");

  const rejected =
    combined.includes("user_declined") ||
    combined.includes("declined") ||
    combined.includes("rejected");

  const noAnswerLike =
    voicemail ||
    combined.includes("dial_no_answer") ||
    combined.includes("dial-no-answer") ||
    combined.includes("dial_busy") ||
    combined.includes("busy") ||
    combined.includes("no_answer") ||
    combined.includes("no-answer") ||
    combined.includes("not_connected");

  if (voicemail) return { kind: "voicemail" };
  if (rejected) return { kind: "call_rejected" };
  if (noAnswerLike) return { kind: "no_answer" };
  return { kind: null };
}

function classifyEndStatus(call: Record<string, unknown>) {
  const callStatus = pickString(call.call_status)?.toLowerCase() ?? "";
  const disconnection = pickString(call.disconnection_reason)?.toLowerCase() ?? "";
  const inVoicemail = getInVoicemail(call);
  const callSuccessful = getCallSuccessful(call);
  const durationMs = getDurationMs(call);
  const { user: userUtterances } = getUserUtteranceCounts(call);
  const spoke = userUtterances > 0;

  // "not_connected" is sometimes used for outbound calls that never connect.
  if (
    callStatus === "not_connected" ||
    inVoicemail ||
    disconnection.includes("no_answer") ||
    disconnection.includes("no-answer") ||
    disconnection.includes("dial_no_answer") ||
    disconnection.includes("dial_no-answer") ||
    disconnection.includes("voicemail") ||
    disconnection.includes("dial_busy") ||
    disconnection.includes("busy") ||
    disconnection.includes("user_declined") ||
    disconnection.includes("declined") ||
    disconnection.includes("rejected")
  ) {
    return "no_answer";
  }

  if (callStatus === "error" || disconnection.includes("error") || disconnection.includes("failed")) {
    return "failed";
  }

  // Retell can report call_status="ended" even when no one answered (e.g. voicemail/no-pickup).
  // If there was no clear user/callee speech, treat it as no-answer and schedule a retry.
  if (callStatus === "ended") {
    if (!spoke) return "no_answer";
    if (callSuccessful === false) return "no_answer";
    // Very short calls without user speech are retries (already handled above), but keep a duration guard.
    if (durationMs !== null && durationMs < 12_000) return "no_answer";
    return "completed";
  }

  // Fallback for unknown end statuses.
  return "ended";
}

function extractCandidateAnswers(call: Record<string, unknown>) {
  // Retell can include extracted/analysis fields under different keys depending on engine/version.
  const candidates: unknown[] = [
    (call as { extracted_data?: unknown }).extracted_data,
    (call as { extracted_data_object?: unknown }).extracted_data_object,
    (call as { call_analysis?: unknown }).call_analysis,
    (call as { post_call_analysis?: unknown }).post_call_analysis,
    (call as { post_call_analysis_data?: unknown }).post_call_analysis_data,
  ];

  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === "object") return c;
  }
  return null;
}

function extractSummary(call: Record<string, unknown>) {
  const direct = (call as { call_summary?: unknown }).call_summary;
  const nested =
    (call as { call_analysis?: { call_summary?: unknown } }).call_analysis?.call_summary ??
    (call as { post_call_analysis?: { call_summary?: unknown } }).post_call_analysis?.call_summary;
  return pickString(direct ?? nested);
}

function extractInterestStatus(call: Record<string, unknown>) {
  const direct = (call as { interest_status?: unknown }).interest_status;
  const nested =
    (call as { call_analysis?: { interest_status?: unknown } }).call_analysis?.interest_status ??
    (call as { post_call_analysis?: { interest_status?: unknown } }).post_call_analysis?.interest_status;
  return pickString(direct ?? nested);
}

function textIndicatesCallbackRequested(text: string) {
  const t = text.toLowerCase();
  const phrases = [
    "call back",
    "callback",
    "call me back",
    "can you call back",
    "call later",
    "later today",
    "later this",
    "not now",
    "busy",
    "in a meeting",
    "driving",
    "can't talk",
    "cannot talk",
    "reach me later",
    "another time",
  ];
  return phrases.some((p) => t.includes(p));
}

function shouldScheduleCallback(opts: { transcript: string | null; summary: string | null; candidateAnswers: unknown }) {
  const parts = [opts.transcript ?? "", opts.summary ?? ""].join("\n").trim();
  if (parts && textIndicatesCallbackRequested(parts)) return true;
  if (opts.candidateAnswers && typeof opts.candidateAnswers === "object") {
    const blob = JSON.stringify(opts.candidateAnswers).toLowerCase();
    if (textIndicatesCallbackRequested(blob)) return true;
  }
  return false;
}

function hasUserUtterance(call: Record<string, unknown>) {
  return getUserUtteranceCounts(call).user > 0;
}

function hasUserUtteranceFromStoredTranscript(transcript: unknown) {
  if (typeof transcript !== "string") return false;
  const counts = countSpeakerTaggedLines(transcript);
  if (counts.user > 0) return true;

  // If we can't see explicit tags, do not assume speech based on freeform text alone.
  return false;
}

function deterministicUuidV4(input: string) {
  const hash = createHash("sha256").update(input).digest();
  const bytes = Uint8Array.from(hash.slice(0, 16));
  // v4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // variant
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function updateSessionRollup(sessionId: string, campaignId: string) {
  // Keep this lightweight: determine whether session is still active or completed.
  // We avoid flipping paused/stopped sessions back to running.
  const { data: sessionRow, error: sessionError } = await supabase
    .from("campaign_call_sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) return;

  const currentStatus = String(sessionRow?.status ?? "").toLowerCase();
  if (currentStatus.startsWith("paused") || currentStatus === "stopped") return;

  const [{ count: queuedCount, error: queuedErr }, { count: callingCount, error: callingErr }] = await Promise.all([
    supabase
      .from("campaign_call_candidates")
      .select("id", { count: "exact", head: true })
      .eq("call_session_id", sessionId)
      .eq("call_status", "queued"),
    supabase
      .from("campaign_call_candidates")
      .select("id", { count: "exact", head: true })
      .eq("call_session_id", sessionId)
      .in("call_status", ["calling", "running", "in_progress"]),
  ]);

  if (queuedErr || callingErr) return;

  const queued = Number(queuedCount ?? 0);
  const calling = Number(callingCount ?? 0);
  const { count: scheduledCount, error: scheduledErr } = await supabase
    .from("campaign_call_candidates")
    .select("id", { count: "exact", head: true })
    .eq("call_session_id", sessionId)
    .in("call_status", ["retry_scheduled", "callback_scheduled"]);
  if (scheduledErr) return;
  const scheduled = Number(scheduledCount ?? 0);

  const now = new Date().toISOString();
  // For sequential outbound calling, treat "queued" candidates as an active session.
  const nextSessionStatus = calling > 0 || queued > 0 || scheduled > 0 ? "running" : "completed";

  await supabase.from("campaign_call_sessions").update({ status: nextSessionStatus, updated_at: now }).eq("id", sessionId);

  if (nextSessionStatus === "completed") {
    // Best-effort campaign completion signal.
    await supabase.from("campaigns").update({ status: "Completed", updated_at: now }).eq("id", campaignId);
  }
}

async function tryAutoAdvance(opts: { campaignId: string; sessionId: string; sessionStatus: string }) {
  const { campaignId, sessionId, sessionStatus } = opts;
  const status = sessionStatus.toLowerCase();
  if (status.startsWith("paused") || status === "stopped" || status === "completed") return;

  // Retry briefly in case the just-finished call row is still visible as "calling" in a concurrent read.
  const waits = [0, 350, 900];
  for (let i = 0; i < waits.length; i += 1) {
    const waitMs = waits[i] ?? 0;
    if (waitMs) await new Promise((r) => setTimeout(r, waitMs));
    const result = await startNextQueuedCall({ campaignId, sessionId });
    console.log("[retell-webhook] auto-advance attempt", { i, result });
    if (result.started) return;
    if (result.reason === "no_queued_candidates" || result.reason === "paused_or_stopped") return;
    if (result.reason === "retell_failed") return;
    // else: already_calling -> retry after short delay
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-retell-signature");

  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing RETELL_API_KEY." }, { status: 500 });
  }

  // Enforce signature in production; allow bypass in dev to simplify local testing.
  const shouldVerify = process.env.NODE_ENV === "production" || Boolean(signatureHeader);
  if (shouldVerify) {
    const verified = verifyRetellWebhookSignature({ rawBody, signatureHeader, apiKey });
    if (!verified.ok) {
      console.error("[retell-webhook] signature verification failed:", verified.reason);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("[retell-webhook] signature header missing; skipping verification (non-production only)");
  }

  const parsed = safeJsonParse(rawBody) as RetellWebhookPayload | null;
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const event = pickString(parsed.event)?.toLowerCase() ?? null;
  const call = parsed.call && typeof parsed.call === "object" ? (parsed.call as Record<string, unknown>) : null;

  if (!event) return NextResponse.json({ error: "Missing event." }, { status: 400 });
  if (!call) return NextResponse.json({ error: "Missing call object." }, { status: 400 });

  const retellCallId = pickString(call.call_id);
  if (!retellCallId) return NextResponse.json({ error: "Missing call.call_id." }, { status: 400 });

  console.log("[retell-webhook] received", {
    event,
    call_id: retellCallId,
    url: request.url,
    host: request.headers.get("host"),
    x_forwarded_host: request.headers.get("x-forwarded-host"),
    has_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE),
  });

  // Safe debug logging (no transcript content).
  try {
    const disconnection = pickString(call.disconnection_reason);
    const durationMs = getDurationMs(call);
    const inVoicemail = getInVoicemail(call);
    const callSuccessful = getCallSuccessful(call);
    const utter = getUserUtteranceCounts(call);
    const hasUser = utter.user > 0;
    const transcriptLen = String((call as { transcript?: unknown }).transcript ?? "").length;
    const transcriptObj = (call as { transcript_object?: unknown }).transcript_object;
    const transcriptObjLen = Array.isArray(transcriptObj) ? transcriptObj.length : null;
    console.log("[retell-webhook] payload summary", {
      event,
      call_id: retellCallId,
      call_status: pickString(call.call_status),
      disconnection_reason: disconnection,
      duration_ms: durationMs,
      in_voicemail: inVoicemail,
      call_successful: callSuccessful,
      has_user_utterance: hasUser,
      utterances: utter,
      transcript_length: transcriptLen,
      transcript_object_length: transcriptObjLen,
    });
  } catch (e) {
    console.warn("[retell-webhook] debug summary failed", e);
  }

  const { data: candidateRow, error: candidateLoadError } = await supabase
    .from("campaign_call_candidates")
    .select("id,user_id,campaign_id,call_session_id,call_status,call_completed_at,attempt_count,max_attempts")
    .eq("retell_call_id", retellCallId)
    .maybeSingle();

  if (candidateLoadError) {
    console.error("[retell-webhook] supabase load error:", candidateLoadError.message);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }

  if (!candidateRow?.id) {
    // Idempotency / late delivery: acknowledge so Retell doesn't retry forever.
    console.warn("[retell-webhook] no matching campaign_call_candidates row for retell_call_id:", retellCallId);
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  const now = new Date().toISOString();
  const retellCallStatus = pickString(call.call_status) ?? null;
  const transcript = pickString(call.transcript) ?? null;
  const callSummary = extractSummary(call);
  const candidateAnswers = extractCandidateAnswers(call);
  const interestStatus = extractInterestStatus(call);
  const endAt = msToIso(call.end_timestamp) ?? now;
  const attemptCount = Number((candidateRow as { attempt_count?: unknown }).attempt_count ?? 0);
  const maxAttempts = Number((candidateRow as { max_attempts?: unknown }).max_attempts ?? 3);

  const update: Record<string, unknown> = {
    retell_call_status: retellCallStatus,
    updated_at: now,
  };

  if (transcript) update.transcript = transcript;
  if (callSummary) update.call_summary = callSummary;
  if (candidateAnswers) update.candidate_answers = candidateAnswers;
  if (interestStatus) update.interest_status = interestStatus;

  const disconnectionReason = pickString(call.disconnection_reason);
  const failureReason = disconnectionReason ?? pickString((call as { error?: unknown }).error);
  if (failureReason && (event === "call_ended" || retellCallStatus === "error" || retellCallStatus === "not_connected")) {
    update.last_error = failureReason;
  }

  const noAnswerSignal = deriveNoAnswerKind({ call, disconnectionReasonRaw: disconnectionReason, failureReasonRaw: failureReason });
  const noAnswerLike = Boolean(noAnswerSignal.kind) || Boolean(getInVoicemail(call)) || isNoAnswerLikeDisconnection(String(disconnectionReason ?? ""));
  const spokeFromPayload = hasUserUtterance(call);
  const durationMs = getDurationMs(call);
  const callSuccessful = getCallSuccessful(call);

  if (event === "call_ended") {
    // First classify based on call fields.
    let next = classifyEndStatus(call);

    // FINAL GUARD: if the provider signaled voicemail/no-answer/decline anywhere (including error/last_error),
    // force no_answer classification even when call_status="ended".
    if (noAnswerSignal.kind) next = "no_answer";

    if (next === "no_answer") {
      const retryReason = noAnswerSignal.kind ?? "no_answer";
      const voicemailDetected = retryReason === "voicemail";

      if (attemptCount < maxAttempts) {
        update.call_status = "retry_scheduled";
        update.retry_reason = retryReason;
        if (voicemailDetected) update.last_error = "voicemail_detected";
        update.next_retry_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        update.call_completed_at = endAt;
      } else {
        update.call_status = "no_answer";
        update.retry_reason = retryReason;
        if (voicemailDetected) update.last_error = "voicemail_detected";
        update.next_retry_at = null;
        update.call_completed_at = endAt;
      }
    } else {
      update.call_status = next;
      update.next_retry_at = null;
      update.retry_reason = null;
      update.call_completed_at = endAt;
    }
  } else if (event === "call_analyzed") {
    // Analysis arrives after end; ensure completion timestamp is set if missing.
    const current = String(candidateRow.call_status ?? "").toLowerCase();
    const signal = deriveNoAnswerKind({ call, disconnectionReasonRaw: disconnectionReason, failureReasonRaw: failureReason });
    if (signal.kind) {
      // Never overwrite a voicemail/no-answer/declined signal into completed.
      // If the row is still marked calling, schedule retry.
      if (current === "calling" || current === "running" || current === "in_progress") {
        const retryReason = signal.kind;
        const voicemailDetected = retryReason === "voicemail";
        if (attemptCount < maxAttempts) {
          update.call_status = "retry_scheduled";
          update.retry_reason = retryReason;
          if (voicemailDetected) update.last_error = "voicemail_detected";
          update.next_retry_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          update.call_completed_at = endAt;
        } else {
          update.call_status = "no_answer";
          update.retry_reason = retryReason;
          if (voicemailDetected) update.last_error = "voicemail_detected";
          update.next_retry_at = null;
          update.call_completed_at = endAt;
        }
      } else if (!pickString((candidateRow as { call_completed_at?: unknown }).call_completed_at)) {
        update.call_completed_at = endAt;
      }
    } else if (current === "calling" || current === "running" || current === "in_progress") {
      update.call_status = "completed";
      update.call_completed_at = endAt;
    } else if (!pickString((candidateRow as { call_completed_at?: unknown }).call_completed_at)) {
      update.call_completed_at = endAt;
    }
  } else if (event === "transcript_updated") {
    // No status change; just persist transcript if present.
  } else if (event === "call_started") {
    // Best effort: reflect provider status.
    if (String(candidateRow.call_status ?? "").toLowerCase() === "queued") {
      update.call_status = "calling";
    }
  } else {
    // Unknown event: still update retell_call_status/transcript/summary if present.
  }

  const { error: updateError } = await supabase.from("campaign_call_candidates").update(update).eq("id", String(candidateRow.id));
  if (updateError) {
    console.error("[retell-webhook] supabase update error:", updateError.message);
    return NextResponse.json({ error: "Database update failed." }, { status: 500 });
  }

  // Billing decision must be based on the persisted row (not only the current webhook payload),
  // since different webhook events can arrive out-of-order or without setting call_status again.
  const { data: persistedCandidate } = await supabase
    .from("campaign_call_candidates")
    .select("call_status,user_id,campaign_id,call_session_id,transcript")
    .eq("id", String(candidateRow.id))
    .maybeSingle();
  const persistedStatusLower = String((persistedCandidate as { call_status?: unknown } | null)?.call_status ?? "")
    .trim()
    .toLowerCase();
  const spoke = spokeFromPayload || hasUserUtteranceFromStoredTranscript((persistedCandidate as { transcript?: unknown } | null)?.transcript);

  // Credits enforcement phase 2:
  // Charge exactly 1 credit for answered/connected calls only (candidate spoke).
  // Do not charge voicemail/no-answer/busy/failed.
  // Idempotency: one charge per retell_call_id (deterministic transaction id).
  const billableEvent = event === "call_analyzed" || event === "call_ended";
  const completed = persistedStatusLower === "completed";
  // Some Retell payloads do not include structured transcripts or speaker tags even for answered calls.
  // If the call is persisted as completed and there are no voicemail/no-answer/busy/decline signals,
  // treat it as a billable answered human call.
  const durationOk = durationMs == null ? true : durationMs >= 12_000;
  const successOk = callSuccessful == null ? true : callSuccessful !== false;
  const shouldBill = billableEvent && completed && !noAnswerLike && durationOk && successOk;

  const billingBlockers: string[] = [];
  if (!billableEvent) billingBlockers.push("event_not_billable");
  if (!completed) billingBlockers.push("status_not_completed");
  if (noAnswerLike) billingBlockers.push("no_answer_like");
  if (!durationOk) billingBlockers.push("duration_too_short");
  if (!successOk) billingBlockers.push("call_successful_false");

  console.log("[retell-webhook] billing check", {
    call_id: retellCallId,
    event,
    persisted_call_status: persistedStatusLower || null,
    has_user_utterance: spoke,
    no_answer_like: noAnswerLike,
    no_answer_kind: noAnswerSignal.kind,
    duration_ms: durationMs,
    call_successful: callSuccessful,
    duration_ok: durationOk,
    success_ok: successOk,
    should_bill: shouldBill,
    billing_blockers: billingBlockers,
  });

  if (shouldBill) {
    const userId = String((persistedCandidate as { user_id?: unknown } | null)?.user_id ?? "").trim();
    const campaignId = String((persistedCandidate as { campaign_id?: unknown } | null)?.campaign_id ?? "").trim();
    if (userId && campaignId) {
      const txId = deterministicUuidV4(`usage:${retellCallId}`);
      let billing: ReturnType<typeof createSupabaseServiceRoleClient>;
      try {
        billing = createSupabaseServiceRoleClient();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Missing Supabase service role configuration.";
        console.error("[retell-webhook] billing blocked (service role missing)", { call_id: retellCallId, message });
        // Return 500 so Retell retries the webhook; once env is fixed, billing can succeed idempotently.
        return NextResponse.json({ error: "Billing configuration error." }, { status: 500 });
      }

      // Snapshot campaign name into billing history so deleting campaigns does not erase finance usage rows.
      let campaignName: string | null = null;
      try {
        const { data: campaignRow } = await billing
          .from("campaigns")
          .select("campaign_name")
          .eq("id", campaignId)
          .maybeSingle();
        const raw = String((campaignRow as { campaign_name?: unknown } | null)?.campaign_name ?? "").trim();
        campaignName = raw ? raw : null;
      } catch {
        // Best-effort only; billing must still proceed even if campaign lookup fails.
        campaignName = null;
      }

      const insertBase = {
        id: txId,
        user_id: userId,
        campaign_id: campaignId,
        type: "usage",
        description: "Answered call",
        credits: -1,
        amount_usd: null,
        status: "completed",
      } as Record<string, unknown>;

      const insertAttempts: Array<{ label: string; row: Record<string, unknown> }> = [
        {
          label: "with_campaign_name_and_metadata",
          row: { ...insertBase, campaign_name: campaignName, metadata: { campaign_name: campaignName } },
        },
        {
          label: "with_metadata_only",
          row: { ...insertBase, metadata: { campaign_name: campaignName } },
        },
        {
          label: "with_campaign_name_only",
          row: { ...insertBase, campaign_name: campaignName },
        },
        { label: "base", row: insertBase },
      ];

      let txErr: { code?: unknown; message?: string } | null = null;
      let inserted = false;

      for (const attempt of insertAttempts) {
        console.log("[retell-webhook] billing tx insert attempt", { call_id: retellCallId, txId, attempt: attempt.label });
        const res = await billing.from("credit_transactions").insert(attempt.row);
        if (!res.error) {
          inserted = true;
          txErr = null;
          console.log("[retell-webhook] billing tx insert success", { call_id: retellCallId, txId, attempt: attempt.label });
          break;
        }

        txErr = res.error as unknown as { code?: unknown; message?: string };
        const code = String(txErr?.code ?? "");
        const message = String(txErr?.message ?? "");
        console.warn("[retell-webhook] billing tx insert failed", {
          call_id: retellCallId,
          txId,
          attempt: attempt.label,
          code: code || null,
          message,
        });

        // Idempotency: treat duplicates as success and skip deduct.
        if (code === "23505") {
          inserted = true;
          break;
        }
      }

      // If already charged, skip deduct.
      const isDuplicate = Boolean(String((txErr as { code?: unknown } | null)?.code ?? "") === "23505");
      if (inserted) {
        if (isDuplicate) {
          console.log("[retell-webhook] billing skipped (duplicate)", { call_id: retellCallId, txId });
        } else {
          console.log("[retell-webhook] billing transaction inserted", { call_id: retellCallId, txId });
          // Best-effort CAS update to avoid lost updates.
          for (let attempt = 0; attempt < 4; attempt += 1) {
            const { data: creditsRow, error: creditsLoadError } = await billing
              .from("user_credits")
              .select("balance,total_used")
              .eq("user_id", userId)
              .maybeSingle();
            if (creditsLoadError) {
              console.warn("[retell-webhook] billing credits load failed", { call_id: retellCallId, userId, message: creditsLoadError.message });
              break;
            }

            const balance = Number((creditsRow as { balance?: unknown } | null)?.balance ?? 0);
            const totalUsed = Number((creditsRow as { total_used?: unknown } | null)?.total_used ?? 0);
            const nextBalance = Math.max(0, balance - 1);
            const nextTotalUsed = totalUsed + 1;

            const { data: updatedRows, error: creditsUpdateError } = await billing
              .from("user_credits")
              .update({ balance: nextBalance, total_used: nextTotalUsed, updated_at: new Date().toISOString() })
              .eq("user_id", userId)
              .eq("balance", balance)
              .select("balance")
              .limit(1);
            if (!creditsUpdateError && updatedRows?.length) {
              console.log("[retell-webhook] billing credits updated", {
                call_id: retellCallId,
                userId,
                previous_balance: balance,
                next_balance: nextBalance,
                next_total_used: nextTotalUsed,
              });
              if (nextBalance <= 0) {
                // Auto-pause outreach when credits are exhausted.
                const sessionId = String((persistedCandidate as { call_session_id?: unknown } | null)?.call_session_id ?? "");
                if (sessionId) {
                  await Promise.all([
                    supabase.from("campaign_call_sessions").update({ status: "paused_credits", updated_at: new Date().toISOString() }).eq("id", sessionId),
                    supabase.from("campaigns").update({ status: "Paused", updated_at: new Date().toISOString() }).eq("id", campaignId),
                  ]);
                }
              }
              break;
            }
            if (creditsUpdateError) {
              console.warn("[retell-webhook] billing credits update failed", {
                call_id: retellCallId,
                userId,
                attempt,
                message: creditsUpdateError.message,
              });
            } else {
              console.warn("[retell-webhook] billing credits update lost race; retrying", {
                call_id: retellCallId,
                userId,
                attempt,
                expected_balance: balance,
              });
            }
          }
        }
      } else {
        console.error("[retell-webhook] billing failed (tx insert)", {
          call_id: retellCallId,
          code: (txErr as { code?: unknown } | null)?.code ?? null,
          message: String((txErr as { message?: unknown } | null)?.message ?? ""),
        });
        // Return 500 so Retell retries; billing is idempotent via deterministic txId.
        return NextResponse.json({ error: "Billing transaction insert failed." }, { status: 500 });
      }
    } else {
      console.warn("[retell-webhook] billing skipped (missing user/campaign)", {
        call_id: retellCallId,
        userIdPresent: Boolean(userId),
        campaignIdPresent: Boolean(campaignId),
      });
    }
  } else {
    console.log("[retell-webhook] billing skipped (not billable)", {
      call_id: retellCallId,
      event,
      persisted_call_status: persistedStatusLower || null,
      has_user_utterance: spoke,
      no_answer_like: noAnswerLike,
    });
  }

  // Callback scheduling: only when the candidate actually spoke and requested a callback.
  // Never schedule callback for voicemail/no-answer outcomes.
  if (event === "call_analyzed") {
    const disconnection = (disconnectionReason ?? "").toLowerCase();
    const inVoicemail = getInVoicemail(call);

    const callbackRequested = shouldScheduleCallback({ transcript, summary: callSummary, candidateAnswers });
    const noAnswerLikeForCallback = inVoicemail || isNoAnswerLikeDisconnection(disconnection) || Boolean(noAnswerSignal.kind);

    if (callbackRequested && spoke && !noAnswerLikeForCallback && attemptCount < maxAttempts) {
      const { data: latestRow } = await supabase
        .from("campaign_call_candidates")
        .select("call_status")
        .eq("id", String(candidateRow.id))
        .maybeSingle();
      const s = String(latestRow?.call_status ?? "").toLowerCase();
      if (s === "completed" || s === "ended") {
        await supabase
          .from("campaign_call_candidates")
          .update({
            call_status: "callback_scheduled",
            retry_reason: "callback_requested",
            next_retry_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", String(candidateRow.id));
      }
    }
  }

  // Roll up session/campaign status for Outreach. Only do this after end/analyzed.
  if (event === "call_ended" || event === "call_analyzed") {
    const sessionId = String(candidateRow.call_session_id ?? "");
    const campaignId = String(candidateRow.campaign_id ?? "");
    if (sessionId && campaignId) {
      await updateSessionRollup(sessionId, campaignId);
    }
  }

  // MVP sequential calling: after a call ends, automatically start the next queued candidate
  // if the session is still active (not paused/stopped/completed).
  if (event === "call_ended" || event === "call_analyzed") {
    const sessionId = String(candidateRow.call_session_id ?? "");
    const campaignId = String(candidateRow.campaign_id ?? "");
    if (sessionId && campaignId) {
      const { data: sessionRow } = await supabase
        .from("campaign_call_sessions")
        .select("status")
        .eq("id", sessionId)
        .maybeSingle();
      const status = String(sessionRow?.status ?? "").toLowerCase();
      console.log("[retell-webhook] auto-advance check", { campaignId, sessionId, status, event });
      await tryAutoAdvance({ campaignId, sessionId, sessionStatus: status });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

