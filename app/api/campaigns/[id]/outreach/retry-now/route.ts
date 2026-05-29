import { startCallForCandidateRow } from "@/lib/outreach/startNextQueuedCall";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: campaignId } = await params;

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const candidateCallId = isObject(payload) ? String(payload.candidateCallId ?? "") : "";
  if (!candidateCallId) return NextResponse.json({ error: "Missing candidateCallId." }, { status: 400 });

  const { data: row, error } = await supabase
    .from("campaign_call_candidates")
    .select("id,campaign_id,call_session_id,call_status,attempt_count,max_attempts")
    .eq("id", candidateCallId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row?.id) return NextResponse.json({ error: "Candidate call not found." }, { status: 404 });
  if (String(row.campaign_id ?? "") !== campaignId) return NextResponse.json({ error: "Candidate call mismatch." }, { status: 409 });

  const attemptCount = Number((row as { attempt_count?: unknown }).attempt_count ?? 0);
  const maxAttempts = Number((row as { max_attempts?: unknown }).max_attempts ?? 3);
  if (attemptCount >= maxAttempts) {
    return NextResponse.json({ error: "Max attempts reached." }, { status: 409 });
  }

  const sessionId = String(row.call_session_id ?? "");
  if (!sessionId) return NextResponse.json({ error: "Missing session id." }, { status: 409 });

  const result = await startCallForCandidateRow({ campaignId, sessionId, candidateRowId: candidateCallId, userId: user.id });
  if (!result.started) {
    const message =
      result.reason === "already_calling"
        ? "Another call is already active for this outreach session."
        : result.reason === "paused_or_stopped"
          ? "Outreach is paused/stopped."
          : result.reason === "not_retryable"
            ? "This candidate is not in a retryable state."
            : "Could not start retry.";
    return NextResponse.json({ error: message, reason: result.reason }, { status: 409 });
  }

  return NextResponse.json({ ok: true, call: result }, { status: 200 });
}

