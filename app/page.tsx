import { AppShell } from "@/components/dashboard/AppShell";
import { StatCard } from "@/components/dashboard/StatCard";
import Link from "next/link";
import { type ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function formatCount(value: number | null | undefined, fallback = "—") {
  if (value == null || Number.isNaN(value)) return fallback;
  return Number(value).toLocaleString();
}

function formatRelativeTime(iso: string | null | undefined) {
  const raw = String(iso ?? "").trim();
  if (!raw) return "—";
  const date = new Date(raw);
  const ts = date.getTime();
  if (Number.isNaN(ts)) return "—";

  const diffMs = ts - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (absSec < 45) return rtf.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 45) return rtf.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 22) return rtf.format(diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 26) return rtf.format(diffDay, "day");
  const diffMo = Math.round(diffDay / 30);
  if (Math.abs(diffMo) < 11) return rtf.format(diffMo, "month");
  const diffYr = Math.round(diffDay / 365);
  return rtf.format(diffYr, "year");
}

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { count: totalCampaignsCount },
    { count: totalCandidatesCount },
    { count: completedCallsCount },
    { count: totalOutreachAttemptsCount },
  ] = await Promise.all([
    supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("candidates").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("campaign_call_candidates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("call_status", ["completed", "done"]),
    supabase.from("campaign_call_candidates").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const stats = [
    {
      label: "Total Campaigns",
      value: formatCount(totalCampaignsCount),
      delta: "All campaigns",
      accent: "indigo" as const,
    },
    {
      label: "Total Candidates",
      value: formatCount(totalCandidatesCount),
      delta: "Uploaded candidates",
      accent: "sky" as const,
    },
    {
      label: "Completed Calls",
      value: formatCount(completedCallsCount),
      delta: "Finished conversations",
      accent: "emerald" as const,
    },
    {
      label: "Total Outreach Attempts",
      value: formatCount(totalOutreachAttemptsCount),
      delta: "Calls attempted",
      accent: "amber" as const,
    },
  ];

  const [
    { count: draftCampaignsCount },
    { count: readyCampaignsCount },
    { count: completedCampaignsCount },
    { count: pausedOutreachCount },
    { count: completedOutreachCount },
    { data: completedSessions },
  ] = await Promise.all([
    supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "Draft"),
    supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "Ready"),
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "Completed"),
    supabase
      .from("campaign_call_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["paused_manual", "paused_calling_window"]),
    supabase.from("campaign_call_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
    supabase.from("campaign_call_sessions").select("campaign_id").eq("user_id", user.id).eq("status", "completed").limit(50000),
  ]);

  const reportsAvailableCount = new Set(
    ((completedSessions ?? []) as Array<{ campaign_id: unknown }>)
      .map((r) => String(r.campaign_id ?? ""))
      .filter(Boolean),
  ).size;

  const draftCount = Number(draftCampaignsCount ?? 0);
  const readyCount = Number(readyCampaignsCount ?? 0);
  const completedCount = Number(completedCampaignsCount ?? 0);
  const setupCount = draftCount + readyCount;

  const awaitingOutreachCount = Number(pausedOutreachCount ?? 0);
  const outreachCompletedCount = Number(completedOutreachCount ?? 0);

  const reportsCount = Number(reportsAvailableCount ?? 0);

  const today: Array<{ title: string; detail: ReactNode; href: string }> = [];

  if (setupCount > 0) {
    today.push({
      title: "Campaigns",
      detail: (
        <>
          {completedCount > 0 ? <span className="block">{completedCount} completed</span> : null}
          {draftCount > 0 ? <span className="block">{draftCount} draft</span> : null}
          {readyCount > 0 ? <span className="block">{readyCount} ready</span> : null}
        </>
      ),
      href: "/campaigns",
    });
  }

  if (awaitingOutreachCount > 0) {
    today.push({
      title: "Outreach",
      detail: (
        <>
          <span className="block">{outreachCompletedCount} completed</span>
          <span className="block">{awaitingOutreachCount} awaiting action</span>
        </>
      ),
      href: "/outreach",
    });
  }

  if (reportsCount > 0) {
    today.push({
      title: "Reports",
      detail: `${reportsCount} report${reportsCount === 1 ? "" : "s"} available`,
      href: "/reports",
    });
  }

  const [
    { data: recentCampaigns },
    { data: recentSessions },
    { data: recentTerminalCalls },
    { data: recentScheduledCalls },
  ] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id,campaign_name,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("campaign_call_sessions")
      .select("id,campaign_id,status,started_at,completed_at,updated_at,created_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("campaign_call_candidates")
      .select("id,campaign_id,candidate_name,call_status,call_completed_at,updated_at,created_at")
      .eq("user_id", user.id)
      .in("call_status", ["completed", "failed", "no_answer"])
      .order("call_completed_at", { ascending: false })
      .limit(12),
    supabase
      .from("campaign_call_candidates")
      .select("id,campaign_id,candidate_name,call_status,call_completed_at,updated_at,created_at")
      .eq("user_id", user.id)
      .in("call_status", ["retry_scheduled", "callback_scheduled"])
      .order("updated_at", { ascending: false })
      .limit(12),
  ]);

  const activityCampaignIds = new Set<string>();
  for (const c of (recentCampaigns ?? []) as Array<{ id: unknown }>) activityCampaignIds.add(String(c.id ?? ""));
  for (const s of (recentSessions ?? []) as Array<{ campaign_id: unknown }>) activityCampaignIds.add(String(s.campaign_id ?? ""));
  for (const r of (recentTerminalCalls ?? []) as Array<{ campaign_id: unknown }>) activityCampaignIds.add(String(r.campaign_id ?? ""));
  for (const r of (recentScheduledCalls ?? []) as Array<{ campaign_id: unknown }>) activityCampaignIds.add(String(r.campaign_id ?? ""));
  activityCampaignIds.delete("");

  const { data: activityCampaignRows } = activityCampaignIds.size
    ? await supabase
        .from("campaigns")
        .select("id,campaign_name")
        .eq("user_id", user.id)
        .in("id", Array.from(activityCampaignIds))
        .limit(5000)
    : { data: [] as Array<{ id: unknown; campaign_name: unknown }> };

  const campaignNameById = new Map<string, string>(
    (activityCampaignRows ?? []).map((r) => [String(r.id ?? ""), String(r.campaign_name ?? "Campaign")]),
  );

  type ActivityItem = { title: string; detail: string; at: string };
  const activityItems: ActivityItem[] = [];

  for (const c of (recentCampaigns ?? []) as Array<{ id: unknown; campaign_name: unknown; created_at: unknown }>) {
    const name = String(c.campaign_name ?? "Campaign");
    const at = String(c.created_at ?? "");
    if (!at) continue;
    activityItems.push({
      title: `Campaign "${name}" created`,
      detail: "New campaign added.",
      at,
    });
  }

  for (const s of (recentSessions ?? []) as Array<{
    campaign_id: unknown;
    status: unknown;
    started_at: unknown;
    completed_at: unknown;
    updated_at: unknown;
    created_at: unknown;
  }>) {
    const campaignId = String(s.campaign_id ?? "");
    const campaignName = campaignNameById.get(campaignId) ?? "Campaign";
    const status = String(s.status ?? "").toLowerCase();

    const startedAt = String(s.started_at ?? "");
    if (startedAt) {
      activityItems.push({
        title: "Outreach started",
        detail: `Campaign "${campaignName}"`,
        at: startedAt,
      });
    }

    if (status === "paused_manual") {
      const at = String(s.updated_at ?? "");
      if (at) {
        activityItems.push({
          title: "Outreach paused manually",
          detail: `Campaign "${campaignName}"`,
          at,
        });
      }
    } else if (status === "paused_calling_window") {
      const at = String(s.updated_at ?? "");
      if (at) {
        activityItems.push({
          title: "Outreach paused (calling window)",
          detail: `Campaign "${campaignName}"`,
          at,
        });
      }
    } else if (status === "stopped") {
      const at = String(s.completed_at ?? s.updated_at ?? "");
      if (at) {
        activityItems.push({
          title: "Outreach stopped",
          detail: `Campaign "${campaignName}"`,
          at,
        });
      }
    } else if (status === "completed") {
      const at = String(s.completed_at ?? s.updated_at ?? "");
      if (at) {
        activityItems.push({
          title: "Outreach completed",
          detail: `Campaign "${campaignName}"`,
          at,
        });
      }
    }
  }

  for (const r of (recentTerminalCalls ?? []) as Array<{
    campaign_id: unknown;
    candidate_name: unknown;
    call_status: unknown;
    call_completed_at: unknown;
    updated_at: unknown;
    created_at: unknown;
  }>) {
    const status = String(r.call_status ?? "").toLowerCase();
    const candidateName = String(r.candidate_name ?? "Candidate") || "Candidate";
    const campaignId = String(r.campaign_id ?? "");
    const campaignName = campaignNameById.get(campaignId) ?? "Campaign";
    const at = String(r.call_completed_at ?? "");
    if (!at) continue;

    if (status === "completed") {
      activityItems.push({ title: `Call completed with "${candidateName}"`, detail: `Campaign "${campaignName}"`, at });
    } else if (status === "failed") {
      activityItems.push({ title: `Call failed for "${candidateName}"`, detail: `Campaign "${campaignName}"`, at });
    } else if (status === "no_answer" || status === "no-answer") {
      activityItems.push({ title: `No answer from "${candidateName}"`, detail: `Campaign "${campaignName}"`, at });
    }
  }

  for (const r of (recentScheduledCalls ?? []) as Array<{
    campaign_id: unknown;
    candidate_name: unknown;
    call_status: unknown;
    updated_at: unknown;
    created_at: unknown;
  }>) {
    const status = String(r.call_status ?? "").toLowerCase();
    const candidateName = String(r.candidate_name ?? "Candidate") || "Candidate";
    const campaignId = String(r.campaign_id ?? "");
    const campaignName = campaignNameById.get(campaignId) ?? "Campaign";
    const at = String(r.updated_at ?? r.created_at ?? "");
    if (!at) continue;

    if (status === "retry_scheduled") {
      activityItems.push({ title: `Retry scheduled for "${candidateName}"`, detail: `Campaign "${campaignName}"`, at });
    } else if (status === "callback_scheduled") {
      activityItems.push({ title: `Callback scheduled for "${candidateName}"`, detail: `Campaign "${campaignName}"`, at });
    }
  }

  activityItems.sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0));
  const recentActivity = activityItems.slice(0, 9).map((a) => ({ title: a.title, detail: a.detail, time: formatRelativeTime(a.at) }));

  return (
    <AppShell
      sidebar={null}
      rightPanel={
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                For you today
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                To‑dos that require your attention.
              </p>
            </div>
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200/70">
              {today.length}
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {today.length ? (
              today.map((t) => (
                <div key={t.title} className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-900">{t.title}</div>
                      <div className="mt-1 text-sm leading-6 text-zinc-600">{t.detail}</div>
                    </div>
                    <Link
                      href={t.href}
                      className="shrink-0 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
                <div className="text-sm font-semibold text-zinc-900">You&apos;re all caught up.</div>
                <div className="mt-1 text-sm leading-6 text-zinc-600">No pending actions right now.</div>
              </div>
            )}
          </div>
        </div>
      }
    >
      <header className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="text-sm font-medium text-zinc-500">Overview</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Hey, Srikanth <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Here’s a quick snapshot of your recruiting activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/workspace"
            className="inline-flex h-10 items-center justify-center rounded-full bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500"
          >
            Go to workspace
          </Link>
          <Link
            href="/reports"
            className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
          >
            View reports
          </Link>
        </div>
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-900">Stats</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              delta={s.delta}
              accent={s.accent}
            />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Recent activity</h2>
            <p className="mt-1 text-sm text-zinc-600">
              A quick rollup of what changed recently.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70">
          <div className="divide-y divide-zinc-200/70">
            {recentActivity.length ? (
              recentActivity.map((a) => (
                <div key={`${a.title}-${a.time}`} className="px-4 py-4 hover:bg-zinc-50/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-900">{a.title}</div>
                      <div className="mt-1 text-sm leading-6 text-zinc-600">{a.detail}</div>
                    </div>
                    <div className="shrink-0 text-xs font-medium text-zinc-500">{a.time}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6">
                <div className="text-sm font-semibold text-zinc-900">No recent activity yet.</div>
                <div className="mt-1 text-sm text-zinc-600">New campaigns and outreach events will appear here as they happen.</div>
              </div>
            )}
          </div>
          <div className="border-t border-zinc-200/70 bg-white px-4 py-3 text-sm">
            <span className="text-zinc-600">
              More activity will appear here as you work in Workspace.
            </span>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
