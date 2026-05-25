import { supabase } from "@/lib/supabaseClient";
import { startNextQueuedCall } from "@/lib/outreach/startNextQueuedCall";
import { verifyRetellWebhookSignature } from "@/lib/retell/verifyWebhookSignature";
import { NextResponse } from "next/server";

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
  if (currentStatus === "paused" || currentStatus === "stopped") return;

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
  if (status === "paused" || status === "stopped" || status === "completed") return;

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
    .select("id,campaign_id,call_session_id,call_status,call_completed_at,attempt_count,max_attempts")
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

  const failureReason = pickString(call.disconnection_reason) ?? pickString((call as { error?: unknown }).error);
  if (failureReason && (event === "call_ended" || retellCallStatus === "error" || retellCallStatus === "not_connected")) {
    update.last_error = failureReason;
  }

  if (event === "call_ended") {
    const next = classifyEndStatus(call);
    if (next === "no_answer") {
      const disconnection = pickString(call.disconnection_reason)?.toLowerCase() ?? "";
      const voicemailDetected = getInVoicemail(call) || disconnection.includes("voicemail");
      const rejected = disconnection.includes("user_declined") || disconnection.includes("declined") || disconnection.includes("rejected");
      const retryReason = voicemailDetected ? "voicemail" : rejected ? "call_rejected" : "no_answer";
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
    if (current === "calling" || current === "running" || current === "in_progress") {
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

  // Callback scheduling: only when the candidate actually spoke and requested a callback.
  // Never schedule callback for voicemail/no-answer outcomes.
  if (event === "call_analyzed") {
    const disconnection = pickString(call.disconnection_reason)?.toLowerCase() ?? "";
    const inVoicemail =
      getInVoicemail(call);

    const callbackRequested = shouldScheduleCallback({ transcript, summary: callSummary, candidateAnswers });
    const spoke = hasUserUtterance(call);
    const noAnswerLike = inVoicemail || isNoAnswerLikeDisconnection(disconnection);

    if (callbackRequested && spoke && !noAnswerLike && attemptCount < maxAttempts) {
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

