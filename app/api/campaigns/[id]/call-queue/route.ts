import { startNextQueuedCall } from "@/lib/outreach/startNextQueuedCall";
import { getCallingWindowState } from "@/lib/callingWindow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type CallSessionStatus = "queued" | "running" | "completed" | "failed" | string;
const PAUSED_CALLING_WINDOW = "paused_calling_window";
const PAUSED_CREDITS = "paused_credits";

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: campaignId } = await params;

  let payload: unknown = null;
  try {
    payload = await _request.json();
  } catch {
    payload = null;
  }
  const overrideCallingWindow =
    payload && typeof payload === "object" && "overrideCallingWindow" in payload
      ? Boolean((payload as { overrideCallingWindow?: unknown }).overrideCallingWindow)
      : false;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,status")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 });
  }
  if (!campaign?.id) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  const campaignStatus = String(campaign.status ?? "");
  const canStartFromStatus = campaignStatus === "Ready" || campaignStatus === "Paused" || campaignStatus === "Calling";
  if (!canStartFromStatus) {
    return NextResponse.json({ error: "Campaign must be Ready before starting calls." }, { status: 409 });
  }

  const activeStatuses: CallSessionStatus[] = ["queued", "running", "paused", "paused_manual", PAUSED_CALLING_WINDOW, PAUSED_CREDITS];
  const { data: existingSession, error: existingError } = await supabase
    .from("campaign_call_sessions")
    .select("id,status,total_candidates,started_at,created_at")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .in("status", activeStatuses)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const windowState = getCallingWindowState();
  const outsideCallingWindow = !windowState.withinWindow;

  if (existingSession?.id) {
    const now = nowIso();
    const sessionId = String(existingSession.id);

    if (outsideCallingWindow && !overrideCallingWindow) {
      const { data: updatedSessions, error: sessionUpdateError } = await supabase
        .from("campaign_call_sessions")
        .update({ status: PAUSED_CALLING_WINDOW, updated_at: now })
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .neq("status", PAUSED_CALLING_WINDOW)
        .select("id")
        .limit(1);
      if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

      const { error: updateCampaignError } = await supabase
        .from("campaigns")
        .update({ status: "Paused", updated_at: now })
        .eq("id", campaignId)
        .eq("user_id", user.id);
      if (updateCampaignError) return NextResponse.json({ error: updateCampaignError.message }, { status: 500 });

      // Notification: only when transitioning into paused_calling_window.
      if (updatedSessions?.length) {
        await supabase.from("notifications").insert({
          id: sessionId,
          user_id: user.id,
          type: "campaign_paused_calling_window",
          title: "Campaign paused",
          message: "Your campaign was paused because it is outside calling hours.",
          related_campaign_id: campaignId,
          related_url: `/outreach?campaignId=${encodeURIComponent(campaignId)}`,
          is_read: false,
        });
      }

      return NextResponse.json(
        {
          sessionId,
          created: false,
          pausedByCallingWindow: true,
          window: windowState,
        },
        { status: 202 },
      );
    }

    // Ensure session is ready to run before starting the next queued call.
    const { error: sessionUpdateError } = await supabase
      .from("campaign_call_sessions")
      .update({ status: "queued", updated_at: now })
      .eq("id", sessionId)
      .eq("user_id", user.id);
    if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

    const { error: updateCampaignError } = await supabase
      .from("campaigns")
      .update({ status: "Calling", updated_at: now })
      .eq("id", campaignId)
      .eq("user_id", user.id);
    if (updateCampaignError) return NextResponse.json({ error: updateCampaignError.message }, { status: 500 });

    const callStart = await startNextQueuedCall({ campaignId, sessionId, userId: user.id });
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
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id);

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
    .in("list_id", listIds)
    .eq("user_id", user.id);

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
      user_id: user.id,
      status: outsideCallingWindow && !overrideCallingWindow ? PAUSED_CALLING_WINDOW : "queued",
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
    user_id: user.id,
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
    .update({ status: outsideCallingWindow && !overrideCallingWindow ? "Paused" : "Calling", updated_at: now })
    .eq("id", campaignId)
    .eq("user_id", user.id);

  if (updateCampaignError) {
    return NextResponse.json({ error: updateCampaignError.message }, { status: 500 });
  }

  if (outsideCallingWindow && !overrideCallingWindow) {
    // Notification: paused by calling window (one per session via id).
    await supabase.from("notifications").insert({
      id: callSessionId,
      user_id: user.id,
      type: "campaign_paused_calling_window",
      title: "Campaign paused",
      message: "Your campaign was paused because it is outside calling hours.",
      related_campaign_id: campaignId,
      related_url: `/outreach?campaignId=${encodeURIComponent(campaignId)}`,
      is_read: false,
    });

    return NextResponse.json(
      {
        sessionId: callSessionId,
        created: true,
        pausedByCallingWindow: true,
        window: windowState,
      },
      { status: 202 },
    );
  }

  const callStart = await startNextQueuedCall({ campaignId, sessionId: callSessionId, userId: user.id });
  return NextResponse.json(
    {
      sessionId: callSessionId,
      created: true,
      call: callStart,
    },
    { status: callStart.started ? 201 : 202 },
  );
}

