import { startCallForCandidateRow } from "@/lib/outreach/startNextQueuedCall";
import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

function nowIso() {
  return new Date().toISOString();
}

export async function POST() {
  const now = nowIso();

  // Find one due retry/callback candidate. We filter attempt_count/max_attempts in-app because
  // Supabase doesn't support cross-column comparisons in the simple query builder.
  const { data: dueRows, error } = await supabase
    .from("campaign_call_candidates")
    .select("id,campaign_id,call_session_id,call_status,next_retry_at,attempt_count,max_attempts")
    .in("call_status", ["retry_scheduled", "callback_scheduled"])
    .lte("next_retry_at", now)
    .order("next_retry_at", { ascending: true })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!dueRows?.length) return NextResponse.json({ ok: true, processed: false, reason: "none_due" }, { status: 200 });

  for (const r of dueRows as Array<{
    id: unknown;
    campaign_id: unknown;
    call_session_id: unknown;
    attempt_count: unknown;
    max_attempts: unknown;
  }>) {
    const candidateRowId = String(r.id ?? "");
    const campaignId = String(r.campaign_id ?? "");
    const sessionId = String(r.call_session_id ?? "");
    if (!candidateRowId || !campaignId || !sessionId) continue;

    const attemptCount = Number(r.attempt_count ?? 0);
    const maxAttempts = Number(r.max_attempts ?? 3);
    if (attemptCount >= maxAttempts) {
      // No more retries; finalize and clear schedule.
      await supabase
        .from("campaign_call_candidates")
        .update({ call_status: "no_answer", next_retry_at: null, updated_at: now })
        .eq("id", candidateRowId);
      continue;
    }

    const { data: sessionRow } = await supabase.from("campaign_call_sessions").select("status").eq("id", sessionId).maybeSingle();
    const status = String(sessionRow?.status ?? "").toLowerCase();
    if (status.startsWith("paused") || status === "stopped" || status === "completed") continue;

    const result = await startCallForCandidateRow({ campaignId, sessionId, candidateRowId });
    return NextResponse.json({ ok: true, processed: true, result }, { status: result.started ? 200 : 202 });
  }

  return NextResponse.json({ ok: true, processed: false, reason: "no_eligible_row" }, { status: 200 });
}

// For Vercel Cron convenience, allow GET as well.
export async function GET() {
  return POST();
}

