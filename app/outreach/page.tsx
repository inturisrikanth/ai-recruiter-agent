import { AppShell } from "@/components/dashboard/AppShell";
import { OutreachControls } from "@/components/outreach/OutreachControls";
import { ContinueAnywayButton } from "@/components/outreach/ContinueAnywayButton";
import { RetryNowButton } from "@/components/outreach/RetryNowButton";
import { getCallingWindowState } from "@/lib/callingWindow";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { notFound } from "next/navigation";

// Ensure fresh data in production (avoid static/cached HTML).
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CampaignStatus = "Draft" | "Ready" | "Calling" | "Paused" | "Completed";
type CallSessionStatus = "queued" | "running" | "completed" | "failed" | string;

function getFirstQueryValue(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function normalizeCampaignStatus(value: string): CampaignStatus {
  if (value === "Ready" || value === "Calling" || value === "Paused" || value === "Completed" || value === "Draft") return value;
  return "Draft";
}

function callSessionLabel(status: CallSessionStatus) {
  const s = String(status ?? "").trim();
  if (!s) return "—";
  if (s.toLowerCase() === "paused_calling_window") return "Paused (Outside Calling Hours)";
  if (s.toLowerCase() === "paused_manual") return "Paused Manually";
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

function pillClass(status: string) {
  const s = status.toLowerCase();
  if (s === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
  if (s === "running" || s === "calling") return "bg-indigo-50 text-indigo-800 ring-indigo-200/70";
  if (s === "queued") return "bg-sky-50 text-sky-800 ring-sky-200/70";
  if (s === "paused" || s.startsWith("paused_")) return "bg-amber-50 text-amber-800 ring-amber-200/70";
  if (s === "stopped") return "bg-zinc-100 text-zinc-700 ring-zinc-200/80";
  if (s === "failed" || s === "no_answer" || s === "no-answer" || s === "no answer") {
    return "bg-rose-50 text-rose-800 ring-rose-200/70";
  }
  return "bg-zinc-100 text-zinc-700 ring-zinc-200/80";
}

type CompactStatCardProps = {
  label: string;
  value: string;
  delta: string;
  badgeLabel?: string;
  accent?: "indigo" | "emerald" | "sky" | "amber" | "rose" | "zinc";
  variant?: "grid" | "sidebar" | "metricsRow";
};

function badgeClasses(accent: NonNullable<CompactStatCardProps["accent"]>) {
  switch (accent) {
    case "emerald":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
    case "sky":
      return "bg-sky-50 text-sky-700 ring-sky-200/70";
    case "amber":
      return "bg-amber-50 text-amber-700 ring-amber-200/70";
    case "rose":
      return "bg-rose-50 text-rose-700 ring-rose-200/70";
    case "zinc":
      return "bg-zinc-100 text-zinc-700 ring-zinc-200/80";
    case "indigo":
    default:
      return "bg-indigo-50 text-indigo-700 ring-indigo-200/70";
  }
}

function CompactStatCard({
  label,
  value,
  delta,
  badgeLabel = "Live",
  accent = "indigo",
  variant = "grid",
}: CompactStatCardProps) {
  const isGrid = variant === "grid";
  const isSidebar = variant === "sidebar";
  const isMetricsRow = variant === "metricsRow";

  const containerClass = isGrid
    ? "rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/70"
    : isMetricsRow
      ? "rounded-2xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200/70"
      : "rounded-2xl bg-zinc-50 px-3 py-2.5 ring-1 ring-zinc-200/70";

  const labelClass = isGrid
    ? "text-sm font-medium text-zinc-500"
    : isMetricsRow
      ? "text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
      : "text-xs font-medium text-zinc-600";

  const valueClass = isGrid
    ? "mt-2 text-2xl font-semibold tracking-tight text-zinc-900"
    : isMetricsRow
      ? "mt-1 text-base font-semibold tracking-tight text-zinc-900"
      : "mt-1 text-lg font-semibold tracking-tight text-zinc-900";

  const deltaClass = isGrid
    ? "mt-1 text-sm text-zinc-600"
    : isMetricsRow
      ? "mt-0.5 text-[11px] leading-tight text-zinc-600"
      : "mt-0.5 text-xs text-zinc-600";

  const badgeClass = isGrid
    ? "rounded-full px-2 py-1 text-xs font-medium ring-1"
    : isMetricsRow
      ? "rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1"
      : "rounded-full px-2 py-1 text-xs font-medium ring-1";

  return (
    <div className={containerClass}>
      <div className={["flex items-start justify-between", isSidebar || isMetricsRow ? "gap-2" : "gap-3"].join(" ")}>
        <div className={labelClass}>{label}</div>
        <span className={[badgeClass, badgeClasses(accent)].join(" ")}>
          {badgeLabel}
        </span>
      </div>
      <div className={valueClass}>{value}</div>
      <div className={deltaClass}>{delta}</div>
    </div>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function classifyCallStatus(value: unknown) {
  const raw = String(value ?? "").trim();
  const norm = raw.toLowerCase().replace(/\s+/g, "_");

  if (norm === "queued") return "queued";
  if (norm === "retry_scheduled") return "retry_scheduled";
  if (norm === "callback_scheduled") return "callback_scheduled";
  if (norm === "calling" || norm === "running" || norm === "in_progress" || norm === "in-progress") return "calling";
  if (norm === "completed" || norm === "done") return "completed";
  if (norm === "failed" || norm === "no_answer" || norm === "no-answer" || norm === "noanswer") return "failed";

  return "other";
}

export default async function OutreachPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const campaignId = getFirstQueryValue(sp.campaignId);

  if (!campaignId) {
    const { data: sessionsData, error: sessionsError } = await supabase
      .from("campaign_call_sessions")
      .select("id,campaign_id,status,total_candidates,updated_at,created_at")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (sessionsError) {
      return (
        <AppShell>
          <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
            <div className="text-sm font-medium text-zinc-500">Outreach</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Outreach</h1>
            <p className="mt-1 text-sm text-zinc-600">Monitor queued and live call operations across campaigns.</p>
          </header>

          <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
            <div className="text-sm font-semibold text-rose-900">Couldn’t load outreach sessions</div>
            <div className="mt-1 text-sm text-rose-800">{sessionsError.message}</div>
          </div>
        </AppShell>
      );
    }

    const latestByCampaign = new Map<
      string,
      { id: string; campaign_id: string; status: string; total_candidates: number; updated_at: string | null; created_at: string }
    >();

    for (const s of (sessionsData ?? []) as Array<{
      id: unknown;
      campaign_id: unknown;
      status: unknown;
      total_candidates: unknown;
      updated_at: unknown;
      created_at: unknown;
    }>) {
      const cid = String(s.campaign_id ?? "");
      if (!cid) continue;
      if (latestByCampaign.has(cid)) continue;
      latestByCampaign.set(cid, {
        id: String(s.id),
        campaign_id: cid,
        status: String(s.status ?? ""),
        total_candidates: Number(s.total_candidates ?? 0),
        updated_at: s.updated_at ? String(s.updated_at) : null,
        created_at: String(s.created_at ?? new Date().toISOString()),
      });
    }

    const campaignIds = Array.from(latestByCampaign.keys());

    if (campaignIds.length === 0) {
      return (
        <AppShell>
          <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
            <div className="text-sm font-medium text-zinc-500">Outreach</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Outreach</h1>
            <p className="mt-1 text-sm text-zinc-600">Monitor queued and live call operations across campaigns.</p>
          </header>

          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
            <div className="text-sm font-semibold text-zinc-900">No outreach sessions yet</div>
            <p className="mt-1 text-sm text-zinc-600">
              Open a campaign and use Step 5 “Start calls” to create a queue and view outreach operations.
            </p>
            <div className="mt-4">
              <Link
                href="/campaigns"
                className="inline-flex h-11 items-center justify-center rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500"
              >
                Go to campaigns
              </Link>
            </div>
          </section>
        </AppShell>
      );
    }

    const { data: campaignsData, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id,campaign_name,job_title,status,updated_at")
      .in("id", campaignIds);

    if (campaignsError) {
      return (
        <AppShell>
          <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
            <div className="text-sm font-medium text-zinc-500">Outreach</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Outreach</h1>
            <p className="mt-1 text-sm text-zinc-600">Monitor queued and live call operations across campaigns.</p>
          </header>

          <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
            <div className="text-sm font-semibold text-rose-900">Couldn’t load campaigns</div>
            <div className="mt-1 text-sm text-rose-800">{campaignsError.message}</div>
          </div>
        </AppShell>
      );
    }

    const campaignById = new Map(
      (campaignsData ?? []).map((c) => [
        String(c.id),
        {
          id: String(c.id),
          name: String(c.campaign_name ?? "Campaign"),
          jobTitle: String(c.job_title ?? "—"),
          status: normalizeCampaignStatus(String(c.status ?? "Draft")),
          updatedAt: c.updated_at ? String(c.updated_at) : null,
        },
      ]),
    );

    const latestSessions = Array.from(latestByCampaign.values()).filter((s) => campaignById.has(s.campaign_id));
    const sessionIds = latestSessions.map((s) => s.id);

    const { data: allCandidatesData, error: allCandidatesError } = sessionIds.length
      ? await supabase
          .from("campaign_call_candidates")
          .select("call_session_id,call_status,updated_at,created_at")
          .in("call_session_id", sessionIds)
          .limit(50000)
      : { data: [], error: null };

    const countsBySession = new Map<string, { queued: number; calling: number; completed: number; failed: number }>();
    for (const sId of sessionIds) {
      countsBySession.set(sId, { queued: 0, calling: 0, completed: 0, failed: 0 });
    }

    for (const row of (allCandidatesData ?? []) as Array<{ call_session_id: unknown; call_status: unknown }>) {
      const sId = String(row.call_session_id ?? "");
      const counts = countsBySession.get(sId);
      if (!counts) continue;
      const kind = classifyCallStatus(row.call_status);
      if (kind === "queued") counts.queued += 1;
      else if (kind === "calling") counts.calling += 1;
      else if (kind === "completed") counts.completed += 1;
      else if (kind === "failed") counts.failed += 1;
    }

    const rows = latestSessions
      .map((s) => {
        const campaign = campaignById.get(s.campaign_id);
        if (!campaign) return null;
        const counts = countsBySession.get(s.id) ?? { queued: 0, calling: 0, completed: 0, failed: 0 };
        const sessionUpdated = s.updated_at ?? s.created_at;
        const lastUpdated = campaign.updatedAt && campaign.updatedAt > sessionUpdated ? campaign.updatedAt : sessionUpdated;

        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          jobTitle: campaign.jobTitle,
          campaignStatus: campaign.status,
          sessionStatus: String(s.status ?? ""),
          totalCandidates: Number(s.total_candidates ?? 0),
          queued: counts.queued,
          calling: counts.calling,
          completed: counts.completed,
          failed: counts.failed,
          lastUpdated,
        };
      })
      .filter(Boolean) as Array<{
      campaignId: string;
      campaignName: string;
      jobTitle: string;
      campaignStatus: CampaignStatus;
      sessionStatus: string;
      totalCandidates: number;
      queued: number;
      calling: number;
      completed: number;
      failed: number;
      lastUpdated: string;
    }>;

    rows.sort((a, b) => (a.lastUpdated > b.lastUpdated ? -1 : a.lastUpdated < b.lastUpdated ? 1 : 0));

    return (
      <AppShell>
        <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-medium text-zinc-500">Outreach</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Outreach</h1>
          <p className="mt-1 text-sm text-zinc-600">Monitor queued and live call operations across campaigns.</p>
        </header>

        {allCandidatesError ? (
          <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
            <div className="text-sm font-semibold text-rose-900">Couldn’t load candidate call stats</div>
            <div className="mt-1 text-sm text-rose-800">{allCandidatesError.message}</div>
          </div>
        ) : null}

        <section className="mt-6">
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Campaign</th>
                    <th className="px-4 py-3">Job title</th>
                    <th className="px-4 py-3">Campaign status</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Queued</th>
                    <th className="px-4 py-3 text-right">Calling</th>
                    <th className="px-4 py-3 text-right">Completed</th>
                    <th className="px-4 py-3 text-right">Failed / no answer</th>
                    <th className="px-4 py-3">Last updated</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/70">
                  {rows.map((r) => (
                    <tr key={r.campaignId} className="hover:bg-zinc-50/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-900">{r.campaignName}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{r.jobTitle || "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                            pillClass(r.campaignStatus),
                          ].join(" ")}
                        >
                          {r.campaignStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-900">{r.totalCandidates.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">{r.queued.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">{r.calling.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">{r.completed.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">{r.failed.toLocaleString()}</td>
                      <td className="px-4 py-3 text-zinc-700">{r.lastUpdated ? formatDateTime(r.lastUpdated) : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Link
                            href={`/outreach?campaignId=${encodeURIComponent(r.campaignId)}`}
                            className="inline-flex h-9 items-center justify-center rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500"
                          >
                            Open outreach
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  const { data: campaignRow, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,campaign_name,status")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError) {
    return (
      <AppShell>
        <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-medium text-zinc-500">Outreach</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Outreach</h1>
          <p className="mt-1 text-sm text-zinc-600">Monitor queued and live call operations for a campaign.</p>
        </header>

        <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
          <div className="text-sm font-semibold text-rose-900">Couldn’t load campaign</div>
          <div className="mt-1 text-sm text-rose-800">{campaignError.message}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/campaigns"
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
            >
              Back to campaigns
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!campaignRow) notFound();

  const campaign = {
    id: String(campaignRow.id),
    name: String(campaignRow.campaign_name ?? "Campaign"),
    status: normalizeCampaignStatus(String(campaignRow.status ?? "Draft")),
  };

  const activeSessionStatuses: CallSessionStatus[] = ["queued", "running", "paused"];
  const { data: activeSession } = await supabase
    .from("campaign_call_sessions")
    .select("id,status,total_candidates,started_at,completed_at,created_at")
    .eq("campaign_id", campaignId)
    .in("status", activeSessionStatuses)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestSession } = !activeSession?.id
    ? await supabase
        .from("campaign_call_sessions")
        .select("id,status,total_candidates,started_at,completed_at,created_at")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const callSession = activeSession?.id ? activeSession : latestSession;

  const sessionId = callSession?.id ? String(callSession.id) : null;
  const sessionStatus = String(callSession?.status ?? "");
  const totalCandidates = Number(callSession?.total_candidates ?? 0);
  const isStopped = sessionStatus.toLowerCase() === "stopped";
  const isPaused = sessionStatus.toLowerCase().startsWith("paused");
  const callingWindow = getCallingWindowState();
  const sessionStatusLower = sessionStatus.toLowerCase();
  const outreachActiveNow =
    Boolean(sessionId) &&
    !isStopped &&
    (sessionStatusLower === "running" || sessionStatusLower === "queued" || sessionStatusLower === "calling" || sessionStatusLower === "in_progress");
  const pausedByCallingWindow = Boolean(sessionId) && sessionStatusLower === "paused_calling_window" && !outreachActiveNow;
  const callingWindowEffectiveStatus: "active" | "paused_quiet_hours" | "paused_manual" | "override" | "inactive" =
    isStopped
      ? "inactive"
      : callingWindow.withinWindow
        ? "active"
        : outreachActiveNow
          ? "override"
          : pausedByCallingWindow
            ? "paused_quiet_hours"
            : isPaused
              ? "paused_manual"
              : "paused_quiet_hours";

  const { data: candidateRows, error: candidateLoadError } = sessionId
    ? await supabase
        .from("campaign_call_candidates")
        .select(
          "id,candidate_name,candidate_phone,candidate_email,call_status,call_completed_at,last_error,attempt_count,max_attempts,next_retry_at,retry_reason,updated_at,created_at",
        )
        .eq("call_session_id", sessionId)
        .order("candidate_name", { ascending: true })
        .limit(5000)
    : { data: null, error: null };

  let queuedCount = 0;
  let retryScheduledCount = 0;
  let callbackScheduledCount = 0;
  let callingCount = 0;
  let completedCount = 0;
  let failedCount = 0;

  for (const r of (candidateRows ?? []) as Array<{ call_status: unknown }>) {
    const kind = classifyCallStatus(r.call_status);
    if (kind === "queued") queuedCount += 1;
    else if (kind === "retry_scheduled") retryScheduledCount += 1;
    else if (kind === "callback_scheduled") callbackScheduledCount += 1;
    else if (kind === "calling") callingCount += 1;
    else if (kind === "completed") completedCount += 1;
    else if (kind === "failed") failedCount += 1;
  }

  return (
    <AppShell>
      <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <Link href="/campaigns" className="font-medium text-zinc-700 hover:text-zinc-900">
                Campaigns
              </Link>
              <span aria-hidden="true">/</span>
              <Link
                href={`/campaigns/${encodeURIComponent(campaign.id)}`}
                className="font-medium text-zinc-700 hover:text-zinc-900"
              >
                {campaign.name}
              </Link>
              <span aria-hidden="true">/</span>
              <span className="truncate text-zinc-500">Outreach</span>
            </div>

            <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Outreach</h1>
            <p className="mt-1 text-sm text-zinc-600">Live and queued call operations for this campaign.</p>
          </div>

          <div className="flex flex-col items-end gap-6">
            <Link
              href={`/campaigns/${encodeURIComponent(campaign.id)}`}
              className={[
                "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold shadow-sm ring-1 transition-colors",
                "bg-indigo-600 text-white ring-indigo-500/20 hover:bg-indigo-500",
              ].join(" ")}
            >
              Back to campaign
            </Link>

            {!isStopped ? (
              <div className="flex justify-end">
                <OutreachControls
                  campaignId={campaign.id}
                  hasSession={Boolean(sessionId)}
                  sessionStatus={sessionStatus || null}
                  compact
                  hidePauseResume={pausedByCallingWindow}
                />
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
        <div className="flex w-full flex-wrap items-start gap-3 sm:flex-nowrap sm:items-center">
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <div className="min-w-[180px] rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Outreach status</div>
              <div className="mt-2">
                {sessionId ? (
                  <span
                    className={[
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                      pillClass(sessionStatus || "zinc"),
                    ].join(" ")}
                  >
                    {callSessionLabel(sessionStatus)}
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-zinc-900">No call session yet</span>
                )}
              </div>
            </div>
            <div className="min-w-[180px] rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Total candidates</div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">{totalCandidates.toLocaleString()}</div>
            </div>
            <div className="min-w-[220px] rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="flex items-start justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Calling window</div>
                <span
                  className={[
                    "rounded-full px-2 py-1 text-xs font-medium ring-1",
                    callingWindowEffectiveStatus === "active"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70"
                      : callingWindowEffectiveStatus === "override"
                        ? "bg-indigo-50 text-indigo-800 ring-indigo-200/70"
                        : callingWindowEffectiveStatus === "inactive"
                          ? "bg-zinc-100 text-zinc-700 ring-zinc-200/80"
                          : "bg-amber-50 text-amber-800 ring-amber-200/70",
                  ].join(" ")}
                >
                  {callingWindowEffectiveStatus === "active"
                    ? "Active"
                    : callingWindowEffectiveStatus === "override"
                      ? "Override active"
                      : callingWindowEffectiveStatus === "inactive"
                        ? "Inactive"
                        : "Paused"}
                </span>
              </div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">{callingWindow.windowLabel}</div>
              <div className="mt-1 text-xs text-zinc-600">Current time: {callingWindow.nowCstLabel}</div>
              <div className="mt-3 text-sm text-zinc-700">
                {callingWindowEffectiveStatus === "active"
                  ? "Calls are currently allowed."
                  : callingWindowEffectiveStatus === "override"
                    ? "Calls are currently running outside the calling window due to an override."
                    : callingWindowEffectiveStatus === "inactive"
                      ? "Outreach is currently stopped."
                      : callingWindowEffectiveStatus === "paused_manual"
                        ? "Outreach is currently paused."
                        : null}
              </div>
              {callingWindowEffectiveStatus === "paused_quiet_hours" ? (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-zinc-600">
                    Calls are paused because it is outside the allowed calling window. You can continue now, or resume outreach during the next calling
                    window.
                  </div>
                  {(!sessionId || pausedByCallingWindow) && !isStopped ? <ContinueAnywayButton campaignId={campaign.id} /> : null}
                </div>
              ) : null}
            </div>
          </div>

        </div>

        {isStopped ? (
          <div className="mt-3 rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
            <div className="font-semibold text-rose-900">Outreach stopped</div>
            <div className="mt-1">
              This outreach was stopped. To start calls again, go back to the campaign, review/activate it, and start outreach again.
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Call metrics</div>
            <div className="mt-1 text-sm text-zinc-600">Live totals for this outreach session.</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          <CompactStatCard
            variant="metricsRow"
            label="Queued"
            value={queuedCount.toLocaleString()}
            delta="Candidates waiting to be called"
            badgeLabel="Queue"
            accent="sky"
          />
          <CompactStatCard
            variant="metricsRow"
            label="Calling"
            value={callingCount.toLocaleString()}
            delta="In-progress calls (placeholder)"
            badgeLabel="Live"
            accent="indigo"
          />
          <CompactStatCard
            variant="metricsRow"
            label="Completed"
            value={completedCount.toLocaleString()}
            delta="Calls completed (placeholder)"
            badgeLabel="Done"
            accent="emerald"
          />
          <CompactStatCard
            variant="metricsRow"
            label="Failed / No answer"
            value={failedCount.toLocaleString()}
            delta="Failed or no-answer (placeholder)"
            badgeLabel="Review"
            accent="rose"
          />
          <CompactStatCard
            variant="metricsRow"
            label="Retry scheduled"
            value={retryScheduledCount.toLocaleString()}
            delta="Will retry automatically when due"
            badgeLabel="Retry"
            accent="amber"
          />
          <CompactStatCard
            variant="metricsRow"
            label="Callback scheduled"
            value={callbackScheduledCount.toLocaleString()}
            delta="Candidate asked for a callback"
            badgeLabel="Callback"
            accent="amber"
          />
        </div>
      </section>

      <section className="mt-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Candidate call queue</h2>
              <p className="mt-1 text-sm text-zinc-600">Operational view of each candidate’s call status for this session.</p>
            </div>
          </div>

          {!sessionId ? (
            <div className="mt-5 rounded-3xl bg-zinc-50 p-4 text-sm text-zinc-700 ring-1 ring-zinc-200/70">
              <div className="font-semibold text-zinc-900">No call session yet</div>
              <div className="mt-1 text-sm text-zinc-600">Go back to the campaign workflow and click Step 5 “Start calls” to create a queue.</div>
            </div>
          ) : candidateLoadError ? (
            <div className="mt-5 rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
              <div className="font-semibold text-rose-900">Couldn’t load call queue</div>
              <div className="mt-1">{candidateLoadError.message}</div>
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-3xl ring-1 ring-zinc-200/70">
              <div className="border-b border-zinc-200/70 bg-zinc-50 px-4 py-3 text-xs font-medium text-zinc-600">
                Tip: scroll right to view retry fields and actions.
              </div>
              <div className="relative overflow-x-auto">
                <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-white/0" aria-hidden="true" />
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Call status</th>
                      <th className="px-4 py-3">Attempts</th>
                      <th className="px-4 py-3">Next retry</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Last updated</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/70 bg-white">
                    {(candidateRows ?? []).length ? (
                      (candidateRows ?? []).map((c) => {
                        const status = String(c.call_status ?? "");
                        const updated = String(c.updated_at ?? c.created_at ?? "");
                        const nextRetryAt = String((c as { next_retry_at?: unknown }).next_retry_at ?? "");
                        const retryReason = String((c as { retry_reason?: unknown }).retry_reason ?? "");
                        const attemptCount = Number((c as { attempt_count?: unknown }).attempt_count ?? 0);
                        const maxAttempts = Number((c as { max_attempts?: unknown }).max_attempts ?? 3);

                        const statusKind = classifyCallStatus(status);
                        const canRetryNow =
                          (statusKind === "retry_scheduled" || statusKind === "callback_scheduled") &&
                          attemptCount < maxAttempts &&
                          !isStopped &&
                          !isPaused &&
                          callingCount === 0;
                        return (
                          <tr key={String(c.id)} className="hover:bg-zinc-50/60">
                            <td className="px-4 py-3 font-medium text-zinc-900">{String(c.candidate_name ?? "") || "—"}</td>
                            <td className="px-4 py-3 text-zinc-700">{String(c.candidate_phone ?? "") || "—"}</td>
                            <td className="px-4 py-3 text-zinc-700">{String(c.candidate_email ?? "") || "—"}</td>
                            <td className="px-4 py-3">
                              <span
                                className={[
                                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                                  pillClass(status || "zinc"),
                                ].join(" ")}
                              >
                                {callSessionLabel(status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-700">
                              <span className="text-sm font-medium text-zinc-900">{attemptCount}</span>
                              <span className="text-sm text-zinc-500"> / {maxAttempts}</span>
                            </td>
                            <td className="px-4 py-3 text-zinc-700">{nextRetryAt ? formatDateTime(nextRetryAt) : "—"}</td>
                            <td className="px-4 py-3 text-zinc-700">{retryReason || "—"}</td>
                            <td className="px-4 py-3 text-zinc-700">{updated ? formatDateTime(updated) : "—"}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                <RetryNowButton campaignId={campaign.id} candidateCallId={String(c.id)} disabled={!canRetryNow} />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center">
                          <div className="text-sm font-semibold text-zinc-900">No candidates</div>
                          <div className="mt-1 text-sm text-zinc-600">This session doesn’t have any queued candidates yet.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

