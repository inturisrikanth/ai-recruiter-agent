import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const candidateId = String(url.searchParams.get("candidateId") ?? "");
  const campaignId = String(url.searchParams.get("campaignId") ?? "");

  if (!candidateId) return NextResponse.json({ error: "Missing candidateId." }, { status: 400 });
  if (!campaignId) return NextResponse.json({ error: "Missing campaignId." }, { status: 400 });

  const { data: row, error } = await supabase
    .from("campaign_call_candidates")
    .select(
      "id,campaign_id,call_session_id,candidate_name,candidate_phone,candidate_email,call_status,interest_status,attempt_count,max_attempts,retry_reason,last_error,next_retry_at,call_completed_at,updated_at,created_at,call_summary,candidate_answers,transcript",
    )
    .eq("id", candidateId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row?.id) return NextResponse.json({ error: "Candidate call not found." }, { status: 404 });
  if (String((row as { campaign_id?: unknown }).campaign_id ?? "") !== campaignId) {
    return NextResponse.json({ error: "Candidate call mismatch." }, { status: 409 });
  }

  return NextResponse.json(
    {
      candidate: {
        id: String(row.id),
        candidate_name: row.candidate_name ?? null,
        candidate_phone: row.candidate_phone ?? null,
        candidate_email: row.candidate_email ?? null,
        call_status: row.call_status ?? null,
        interest_status: (row as { interest_status?: unknown }).interest_status ?? null,
        attempt_count: (row as { attempt_count?: unknown }).attempt_count ?? null,
        max_attempts: (row as { max_attempts?: unknown }).max_attempts ?? null,
        retry_reason: (row as { retry_reason?: unknown }).retry_reason ?? null,
        last_error: (row as { last_error?: unknown }).last_error ?? null,
        next_retry_at: (row as { next_retry_at?: unknown }).next_retry_at ?? null,
        call_completed_at: (row as { call_completed_at?: unknown }).call_completed_at ?? null,
        updated_at: (row as { updated_at?: unknown }).updated_at ?? null,
        created_at: (row as { created_at?: unknown }).created_at ?? null,
        call_summary: (row as { call_summary?: unknown }).call_summary ?? null,
        candidate_answers: (row as { candidate_answers?: unknown }).candidate_answers ?? null,
        transcript: (row as { transcript?: unknown }).transcript ?? null,
      },
    },
    { status: 200 },
  );
}

