import { supabase } from "@/lib/supabaseClient";
import { startNextQueuedCall } from "@/lib/outreach/startNextQueuedCall";
import { NextResponse } from "next/server";

type CallSessionStatus = "queued" | "running" | "completed" | "failed" | string;

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function nowIso() {
  return new Date().toISOString();
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
    const callStart = await startNextQueuedCall({ campaignId, sessionId });
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

  const callStart = await startNextQueuedCall({ campaignId, sessionId: callSessionId });
  return NextResponse.json(
    {
      sessionId: callSessionId,
      created: true,
      call: callStart,
    },
    { status: callStart.started ? 201 : 202 },
  );
}

