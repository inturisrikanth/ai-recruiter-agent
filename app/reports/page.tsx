import { AppShell } from "@/components/dashboard/AppShell";
import { CampaignReportCandidatesTable } from "@/components/reports/CampaignReportCandidatesTable";
import { DownloadCampaignReportButton } from "@/components/reports/DownloadCampaignReportButton";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CampaignStatus = "Draft" | "Ready" | "Calling" | "Paused" | "Completed";

function getFirstQueryValue(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function normalizeCampaignStatus(value: string): CampaignStatus {
  if (value === "Ready" || value === "Calling" || value === "Paused" || value === "Completed" || value === "Draft") return value;
  return "Draft";
}

function pillClass(status: string) {
  const s = status.toLowerCase();
  if (s === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
  if (s === "running" || s === "calling") return "bg-indigo-50 text-indigo-800 ring-indigo-200/70";
  if (s === "queued") return "bg-sky-50 text-sky-800 ring-sky-200/70";
  if (s === "paused") return "bg-amber-50 text-amber-800 ring-amber-200/70";
  if (s === "stopped") return "bg-zinc-100 text-zinc-700 ring-zinc-200/80";
  if (s === "failed" || s === "no_answer" || s === "no-answer" || s === "no answer") {
    return "bg-rose-50 text-rose-800 ring-rose-200/70";
  }
  return "bg-zinc-100 text-zinc-700 ring-zinc-200/80";
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

function normalizeCallStatus(value: unknown) {
  const raw = String(value ?? "").trim();
  return raw.toLowerCase().replace(/\s+/g, "_");
}

function MetricTile({
  label,
  value,
  helper,
  accent = "zinc",
}: {
  label: string;
  value: string;
  helper?: string;
  accent?: "indigo" | "emerald" | "sky" | "amber" | "rose" | "zinc";
}) {
  const accentClass =
    accent === "emerald"
      ? "bg-emerald-50 ring-emerald-200/70"
      : accent === "rose"
        ? "bg-rose-50 ring-rose-200/70"
        : accent === "amber"
          ? "bg-amber-50 ring-amber-200/70"
          : accent === "sky"
            ? "bg-sky-50 ring-sky-200/70"
            : accent === "indigo"
              ? "bg-indigo-50 ring-indigo-200/70"
              : "bg-zinc-50 ring-zinc-200/70";

  const valueClass =
    accent === "emerald"
      ? "text-emerald-900"
      : accent === "rose"
        ? "text-rose-900"
        : accent === "amber"
          ? "text-amber-900"
          : accent === "sky"
            ? "text-sky-900"
            : accent === "indigo"
              ? "text-indigo-950"
              : "text-zinc-900";

  return (
    <div className={["rounded-3xl p-4 ring-1 shadow-sm", accentClass].join(" ")}>
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{label}</div>
      <div className={["mt-2 text-2xl font-semibold tracking-tight", valueClass].join(" ")}>{value}</div>
      {helper ? <div className="mt-1 text-sm text-zinc-600">{helper}</div> : null}
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const campaignId = getFirstQueryValue(sp.campaignId);

  if (!campaignId) {
    const { data: sessionsData, error: sessionsError } = await supabase
      .from("campaign_call_sessions")
      .select("id,campaign_id,status,total_candidates,completed_at,updated_at,created_at")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (sessionsError) {
      return (
        <AppShell>
          <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
            <div className="text-sm font-medium text-zinc-500">Reports</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Reports</h1>
            <p className="mt-1 text-sm text-zinc-600">Review completed call results, summaries, and candidate outcomes.</p>
          </header>

          <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
            <div className="text-sm font-semibold text-rose-900">Couldn’t load completed outreach sessions</div>
            <div className="mt-1 text-sm text-rose-800">{sessionsError.message}</div>
          </div>
        </AppShell>
      );
    }

    const latestCompletedByCampaign = new Map<
      string,
      {
        id: string;
        campaign_id: string;
        status: string;
        total_candidates: number;
        completed_at: string | null;
        updated_at: string | null;
        created_at: string;
      }
    >();

    for (const s of (sessionsData ?? []) as Array<{
      id: unknown;
      campaign_id: unknown;
      status: unknown;
      total_candidates: unknown;
      completed_at: unknown;
      updated_at: unknown;
      created_at: unknown;
    }>) {
      const cid = String(s.campaign_id ?? "");
      if (!cid) continue;
      if (latestCompletedByCampaign.has(cid)) continue;

      const statusLower = String(s.status ?? "").toLowerCase();
      if (statusLower !== "completed") continue;

      latestCompletedByCampaign.set(cid, {
        id: String(s.id),
        campaign_id: cid,
        status: String(s.status ?? ""),
        total_candidates: Number(s.total_candidates ?? 0),
        completed_at: s.completed_at ? String(s.completed_at) : null,
        updated_at: s.updated_at ? String(s.updated_at) : null,
        created_at: String(s.created_at ?? new Date().toISOString()),
      });
    }

    const campaignIds = Array.from(latestCompletedByCampaign.keys());
    if (campaignIds.length === 0) {
      return (
        <AppShell>
          <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
            <div className="text-sm font-medium text-zinc-500">Reports</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Reports</h1>
            <p className="mt-1 text-sm text-zinc-600">Review completed call results, summaries, and candidate outcomes.</p>
          </header>

          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
            <div className="text-sm font-semibold text-zinc-900">No completed campaign reports yet</div>
            <p className="mt-1 text-sm text-zinc-600">Completed campaign reports will appear here after outreach finishes.</p>
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
            <div className="text-sm font-medium text-zinc-500">Reports</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Reports</h1>
            <p className="mt-1 text-sm text-zinc-600">Review completed call results, summaries, and candidate outcomes.</p>
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

    const latestSessions = Array.from(latestCompletedByCampaign.values()).filter((s) => campaignById.has(s.campaign_id));
    const sessionIds = latestSessions.map((s) => s.id);

    const { data: allCandidatesData, error: allCandidatesError } = sessionIds.length
      ? await supabase
          .from("campaign_call_candidates")
          .select("call_session_id,call_status,retry_reason,last_error,updated_at,created_at")
          .in("call_session_id", sessionIds)
          .limit(50000)
      : { data: [], error: null };

    const countsBySession = new Map<
      string,
      {
        completed: number;
        noAnswer: number;
        failed: number;
        retryScheduled: number;
        callbackScheduled: number;
      }
    >();
    for (const sId of sessionIds) {
      countsBySession.set(sId, { completed: 0, noAnswer: 0, failed: 0, retryScheduled: 0, callbackScheduled: 0 });
    }

    for (const row of (allCandidatesData ?? []) as Array<{
      call_session_id: unknown;
      call_status: unknown;
      retry_reason: unknown;
      last_error: unknown;
    }>) {
      const sId = String(row.call_session_id ?? "");
      const counts = countsBySession.get(sId);
      if (!counts) continue;

      const status = normalizeCallStatus(row.call_status);
      const retryReason = String(row.retry_reason ?? "").toLowerCase();
      const lastError = String(row.last_error ?? "").toLowerCase();

      if (status === "completed" || status === "done") {
        counts.completed += 1;
        continue;
      }

      if (status === "callback_scheduled") {
        counts.callbackScheduled += 1;
        continue;
      }

      if (status === "retry_scheduled") {
        counts.retryScheduled += 1;
        if (retryReason === "no_answer" || retryReason === "voicemail" || lastError.includes("no_answer") || lastError.includes("voicemail")) {
          counts.noAnswer += 1;
        }
        continue;
      }

      if (status === "no_answer" || status === "no-answer" || status === "voicemail") {
        counts.noAnswer += 1;
        continue;
      }

      if (status === "failed") {
        if (lastError.includes("no_answer") || lastError.includes("voicemail")) counts.noAnswer += 1;
        else counts.failed += 1;
        continue;
      }
    }

    const rows = latestSessions
      .map((s) => {
        const campaign = campaignById.get(s.campaign_id);
        if (!campaign) return null;
        const counts = countsBySession.get(s.id) ?? {
          completed: 0,
          noAnswer: 0,
          failed: 0,
          retryScheduled: 0,
          callbackScheduled: 0,
        };
        const sessionUpdated = s.updated_at ?? s.created_at;
        const lastUpdated = campaign.updatedAt && campaign.updatedAt > sessionUpdated ? campaign.updatedAt : sessionUpdated;
        const completedAt = s.completed_at ?? lastUpdated;

        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          jobTitle: campaign.jobTitle,
          campaignStatus: campaign.status,
          totalCalls: Number(s.total_candidates ?? 0),
          completedCalls: counts.completed,
          noAnswerCalls: counts.noAnswer,
          failedCalls: counts.failed,
          retryScheduled: counts.retryScheduled,
          callbackScheduled: counts.callbackScheduled,
          completedAt,
          lastUpdated,
        };
      })
      .filter(Boolean) as Array<{
      campaignId: string;
      campaignName: string;
      jobTitle: string;
      campaignStatus: CampaignStatus;
      totalCalls: number;
      completedCalls: number;
      noAnswerCalls: number;
      failedCalls: number;
      retryScheduled: number;
      callbackScheduled: number;
      completedAt: string;
      lastUpdated: string;
    }>;

    rows.sort((a, b) => (a.completedAt > b.completedAt ? -1 : a.completedAt < b.completedAt ? 1 : 0));

    return (
      <AppShell>
        <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-medium text-zinc-500">Reports</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-zinc-600">Review completed call results, summaries, and candidate outcomes.</p>
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
                      <td className="px-4 py-3 text-zinc-700">{r.completedAt ? formatDateTime(r.completedAt) : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Link
                            href={`/reports?campaignId=${encodeURIComponent(r.campaignId)}`}
                            className="inline-flex h-9 items-center justify-center rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500"
                          >
                            Open report
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

  function interestKind(value: unknown): "interested" | "not_interested" | "unknown" {
    const s = String(value ?? "").trim().toLowerCase();
    if (!s) return "unknown";
    if (s.includes("interested") && !s.includes("not")) return "interested";
    if (s.includes("not_interested") || s.includes("not interested") || s === "no") return "not_interested";
    if (s === "unknown" || s === "unsure" || s === "neutral") return "unknown";
    return "unknown";
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id,campaign_name,job_title,status,updated_at")
    .eq("id", campaignId)
    .maybeSingle();

  if (error || !campaign?.id) {
    return (
      <AppShell>
        <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-medium text-zinc-500">Reports</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Campaign report</h1>
          <p className="mt-1 text-sm text-zinc-600">Campaign report will show completed call results here.</p>
        </header>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-semibold text-zinc-900">Report not available</div>
          <p className="mt-1 text-sm text-zinc-600">
            {error ? "We couldn’t load this campaign report." : "This campaign does not exist or is not accessible."}
          </p>
          {error ? <div className="mt-3 text-sm text-rose-700">{error.message}</div> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/reports"
              className="inline-flex h-11 items-center justify-center rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500"
            >
              Back to reports
            </Link>
            <Link
              href="/campaigns"
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
            >
              Go to campaigns
            </Link>
          </div>
        </section>
      </AppShell>
    );
  }

  const campaignStatus = normalizeCampaignStatus(String((campaign as { status?: unknown }).status ?? "Draft"));

  const { data: sessionsData, error: sessionsError } = await supabase
    .from("campaign_call_sessions")
    .select("id,status,total_candidates,completed_at,updated_at,created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (sessionsError) {
    return (
      <AppShell>
        <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-medium text-zinc-500">Reports</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Campaign report</h1>
          <p className="mt-1 text-sm text-zinc-600">Review completed call results, summaries, and candidate outcomes.</p>
        </header>

        <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
          <div className="text-sm font-semibold text-rose-900">Couldn’t load outreach sessions</div>
          <div className="mt-1 text-sm text-rose-800">{sessionsError.message}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/reports"
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
            >
              Back to reports
            </Link>
            <Link
              href={`/outreach?campaignId=${encodeURIComponent(campaignId)}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500"
            >
              Back to outreach
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const session =
    (sessionsData ?? []).find((s) => String((s as { status?: unknown }).status ?? "").toLowerCase() === "completed") ??
    (sessionsData ?? [])[0] ??
    null;

  if (!session?.id) {
    return (
      <AppShell>
        <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-medium text-zinc-500">Reports</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Campaign report</h1>
          <p className="mt-1 text-sm text-zinc-600">Review completed call results, summaries, and candidate outcomes.</p>
        </header>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-semibold text-zinc-900">No report data yet</div>
          <p className="mt-1 text-sm text-zinc-600">
            This campaign doesn’t have outreach results yet. Once outreach finishes, the report will appear here.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/outreach?campaignId=${encodeURIComponent(campaignId)}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500"
            >
              Back to outreach
            </Link>
            <Link
              href="/reports"
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
            >
              Back to reports
            </Link>
          </div>
        </section>
      </AppShell>
    );
  }

  const sessionId = String(session.id);

  const { data: candidateRows, error: candidateError } = await supabase
    .from("campaign_call_candidates")
    .select("id,candidate_name,candidate_phone,candidate_email,interest_status,call_status,updated_at,created_at")
    .eq("call_session_id", sessionId)
    .order("candidate_name", { ascending: true })
    .limit(5000);

  if (candidateError) {
    return (
      <AppShell>
        <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-medium text-zinc-500">Reports</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Campaign report</h1>
          <p className="mt-1 text-sm text-zinc-600">Review completed call results, summaries, and candidate outcomes.</p>
        </header>

        <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
          <div className="text-sm font-semibold text-rose-900">Couldn’t load candidate results</div>
          <div className="mt-1 text-sm text-rose-800">{candidateError.message}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/reports"
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
            >
              Back to reports
            </Link>
            <Link
              href={`/outreach?campaignId=${encodeURIComponent(campaignId)}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500"
            >
              Back to outreach
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const candidates = (candidateRows ?? []).map((r) => ({
    id: String(r.id),
    candidate_name: String(r.candidate_name ?? "Candidate"),
    candidate_phone: r.candidate_phone ? String(r.candidate_phone) : null,
    candidate_email: r.candidate_email ? String(r.candidate_email) : null,
    interest_status: (r as { interest_status?: unknown }).interest_status ? String((r as { interest_status?: unknown }).interest_status) : null,
    call_status: (r as { call_status?: unknown }).call_status ? String((r as { call_status?: unknown }).call_status) : null,
    updated_at: r.updated_at ? String(r.updated_at) : null,
    created_at: r.created_at ? String(r.created_at) : null,
  }));

  let completedCalls = 0;
  let noAnswerCalls = 0;
  let failedCalls = 0;
  let interested = 0;
  let notInterested = 0;
  let interestUnknown = 0;

  for (const r of candidates) {
    const status = normalizeCallStatus(r.call_status);
    if (status === "completed" || status === "done") completedCalls += 1;
    else if (status === "no_answer" || status === "no-answer" || status === "voicemail") noAnswerCalls += 1;
    else if (status === "failed") failedCalls += 1;

    const ik = interestKind(r.interest_status);
    if (ik === "interested") interested += 1;
    else if (ik === "not_interested") notInterested += 1;
    else interestUnknown += 1;
  }

  const totalCalls = Number((session as { total_candidates?: unknown }).total_candidates ?? candidates.length ?? 0);
  const completedAtRaw =
    String((session as { completed_at?: unknown }).completed_at ?? "") ||
    String((session as { updated_at?: unknown }).updated_at ?? "") ||
    String((session as { created_at?: unknown }).created_at ?? "");
  const completedAt = completedAtRaw ? completedAtRaw : null;

  return (
    <AppShell>
      <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <Link href="/reports" className="font-medium text-zinc-700 hover:text-zinc-900">
                Reports
              </Link>
              <span aria-hidden="true">/</span>
              <span className="truncate text-zinc-500">{String(campaign.campaign_name ?? "Campaign")}</span>
            </div>

            <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Campaign report</h1>
            <p className="mt-1 text-sm text-zinc-600">Completed outreach results for this campaign.</p>
          </div>

          <div className="flex flex-col items-end gap-5">
            <div className="flex flex-wrap justify-end gap-3">
              <Link
                href="/reports"
                className="inline-flex h-11 min-w-[180px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500/15"
              >
                Back to all reports
              </Link>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                href={`/campaigns/${encodeURIComponent(campaignId)}`}
                className="inline-flex h-11 min-w-[180px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-white px-5 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-200/70 transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
              >
                Open this campaign
              </Link>
              <div className="min-w-[180px]">
                <DownloadCampaignReportButton campaignId={campaignId} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div className="min-w-0 rounded-3xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Campaign</div>
            <div className="mt-1 text-sm font-semibold leading-snug text-zinc-900 break-words">
              {String(campaign.campaign_name ?? "Campaign")}
            </div>
          </div>
          <div className="min-w-0 rounded-3xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Job title</div>
            <div className="mt-1 text-sm font-semibold leading-snug text-zinc-900 break-words">{String(campaign.job_title ?? "—")}</div>
          </div>
          <div className="min-w-0 rounded-3xl bg-zinc-50 p-3 ring-1 ring-zinc-200/70">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Campaign status</div>
            <div className="mt-1">
              <span
                className={[
                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                  pillClass(campaignStatus),
                ].join(" ")}
              >
                {campaignStatus}
              </span>
            </div>
            {completedAt ? <div className="mt-2 text-xs text-zinc-600">Last updated {formatDateTime(completedAt)}</div> : null}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          <MetricTile label="Total calls" value={totalCalls.toLocaleString()} helper="Candidates called" accent="zinc" />
          <MetricTile label="Completed" value={completedCalls.toLocaleString()} helper="Finished calls" accent="emerald" />
          <MetricTile label="No answer" value={noAnswerCalls.toLocaleString()} helper="No pickup / voicemail" accent="rose" />
          <MetricTile label="Failed" value={failedCalls.toLocaleString()} helper="Call failures" accent="rose" />
          <MetricTile
            label="Interest"
            value={`${interested}/${notInterested}/${interestUnknown}`}
            helper="Interested / not interested / unknown"
            accent="indigo"
          />
        </div>
      </section>

      <section className="mt-6">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Candidate results</h2>
              <p className="mt-1 text-sm text-zinc-600">One row per candidate call. Open details for transcript, answers, and summary.</p>
            </div>
          </div>
          <div className="mt-4">
            <CampaignReportCandidatesTable campaignId={campaignId} candidates={candidates} />
          </div>
        </div>
      </section>
    </AppShell>
  );
}

