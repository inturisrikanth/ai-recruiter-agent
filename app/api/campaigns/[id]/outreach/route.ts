import { getCallingWindowState } from "@/lib/callingWindow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Action = "pause" | "resume" | "stop";
const PAUSED_CALLING_WINDOW = "paused_calling_window";
const PAUSED_MANUAL = "paused_manual";

function isAction(value: unknown): value is Action {
  return value === "pause" || value === "resume" || value === "stop";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const action = payload && typeof payload === "object" && "action" in payload ? (payload as { action?: unknown }).action : null;
  if (!isAction(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,status")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });
  if (!campaign?.id) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  // Prefer an active session if present, otherwise fall back to the latest session.
  const activeStatuses = ["queued", "running", "paused", PAUSED_CALLING_WINDOW, PAUSED_MANUAL];
  const { data: activeSession, error: activeError } = await supabase
    .from("campaign_call_sessions")
    .select("id,status,created_at")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .in("status", activeStatuses)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) return NextResponse.json({ error: activeError.message }, { status: 500 });

  const { data: latestSession, error: latestError } = !activeSession?.id
    ? await supabase
        .from("campaign_call_sessions")
        .select("id,status,created_at")
        .eq("campaign_id", campaignId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };

  if (latestError) return NextResponse.json({ error: latestError.message }, { status: 500 });

  const session = activeSession?.id ? activeSession : latestSession;
  if (!session?.id) {
    return NextResponse.json({ error: "No call session exists for this campaign." }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (action === "pause") {
    const { error: sessionUpdateError } = await supabase
      .from("campaign_call_sessions")
      .update({ status: PAUSED_MANUAL, updated_at: now })
      .eq("id", String(session.id))
      .eq("user_id", user.id);
    if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

    // Reflect paused state across the app.
    const { error: campaignUpdateError } = await supabase
      .from("campaigns")
      .update({ status: "Paused", updated_at: now })
      .eq("id", campaignId)
      .eq("user_id", user.id);
    if (campaignUpdateError) return NextResponse.json({ error: campaignUpdateError.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (action === "resume") {
    const windowState = getCallingWindowState();
    if (!windowState.withinWindow) {
      const { error: sessionUpdateError } = await supabase
        .from("campaign_call_sessions")
        .update({ status: PAUSED_CALLING_WINDOW, updated_at: now })
        .eq("id", String(session.id))
        .eq("user_id", user.id);
      if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

      const { error: campaignUpdateError } = await supabase
        .from("campaigns")
        .update({ status: "Paused", updated_at: now })
        .eq("id", campaignId)
        .eq("user_id", user.id);
      if (campaignUpdateError) return NextResponse.json({ error: campaignUpdateError.message }, { status: 500 });

      return NextResponse.json({ ok: true, pausedByCallingWindow: true, window: windowState }, { status: 202 });
    }

    const { error: sessionUpdateError } = await supabase
      .from("campaign_call_sessions")
      .update({ status: "queued", updated_at: now })
      .eq("id", String(session.id))
      .eq("user_id", user.id);
    if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

    const { error: campaignUpdateError } = await supabase
      .from("campaigns")
      .update({ status: "Calling", updated_at: now })
      .eq("id", campaignId)
      .eq("user_id", user.id);
    if (campaignUpdateError) return NextResponse.json({ error: campaignUpdateError.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // action === "stop"
  const { error: sessionUpdateError } = await supabase
    .from("campaign_call_sessions")
    .update({ status: "stopped", updated_at: now, completed_at: now })
    .eq("id", String(session.id))
    .eq("user_id", user.id);
  if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 });

  // The campaign table doesn't currently support a dedicated "Stopped" status in the MVP.
  const { error: campaignUpdateError } = await supabase
    .from("campaigns")
    .update({ status: "Draft", updated_at: now })
    .eq("id", campaignId)
    .eq("user_id", user.id);
  if (campaignUpdateError) return NextResponse.json({ error: campaignUpdateError.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

