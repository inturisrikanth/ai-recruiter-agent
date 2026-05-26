import { CampaignDeleteAction } from "@/components/campaigns/CampaignDetailActions";
import { DuplicateCampaignAction } from "@/components/campaigns/DuplicateCampaignAction";
import { CampaignWorkflow } from "@/components/campaigns/CampaignWorkflow";
import { AppShell } from "@/components/dashboard/AppShell";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { notFound } from "next/navigation";

// Ensure fresh data in production (avoid cached RSC/HTML).
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CampaignStatus = "Draft" | "Ready" | "Calling" | "Paused" | "Completed";
type EmploymentType = "Full-time" | "Part-time" | "Contract" | "Internship";

function normalizeStatus(value: string): CampaignStatus {
  if (value === "Ready" || value === "Calling" || value === "Paused" || value === "Completed" || value === "Draft") return value;
  // Legacy / unknown statuses (e.g. Active) are treated as Draft in the MVP.
  return "Draft";
}

function normalizeEmploymentType(value: string): EmploymentType {
  if (
    value === "Full-time" ||
    value === "Part-time" ||
    value === "Contract" ||
    value === "Internship"
  ) {
    return value;
  }
  return "Full-time";
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

function parseSkills(skills: string) {
  return skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function statusPill(status: CampaignStatus) {
  switch (status) {
    case "Completed":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
    case "Calling":
      return "bg-indigo-50 text-indigo-800 ring-indigo-200/70";
    case "Paused":
      return "bg-amber-50 text-amber-900 ring-amber-200/70";
    case "Ready":
      return "bg-sky-50 text-sky-800 ring-sky-200/70";
    case "Draft":
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200/80";
  }
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id,campaign_name,job_title,job_description,required_skills,employment_type,status,candidate_count,created_at,updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-medium text-zinc-500">Campaign</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Campaign details
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            View campaign configuration and status.
          </p>
        </div>

        <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
          <div className="text-sm font-semibold text-rose-900">
            Couldn’t load campaign
          </div>
          <div className="mt-1 text-sm text-rose-800">{error.message}</div>
          <div className="mt-4">
            <Link
              href="/campaigns"
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
            >
              Back to Campaigns
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!data) notFound();

  const campaign = {
    id: String(data.id),
    campaignName: String(data.campaign_name),
    jobTitle: String(data.job_title),
    jobDescription: String(data.job_description),
    requiredSkills: String(data.required_skills ?? ""),
    employmentType: normalizeEmploymentType(String(data.employment_type ?? "")),
    status: normalizeStatus(String(data.status ?? "Draft")),
    candidateCount: Number(data.candidate_count ?? 0),
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at ?? data.created_at),
  };

  const skills = parseSkills(campaign.requiredSkills);

  const { data: attachedLinks, error: attachedLinksError } = await supabase
    .from("campaign_candidate_lists")
    .select("list_id,created_at")
    .eq("campaign_id", id)
    .order("created_at", { ascending: true });

  const attachedListIds = (attachedLinks ?? []).map((r) => String(r.list_id));
  const { data: attachedLists, error: attachedListsError } = attachedListIds.length
    ? await supabase.from("candidate_lists").select("id,list_name").in("id", attachedListIds)
    : { data: [], error: null };

  const nameById = new Map((attachedLists ?? []).map((r) => [String(r.id), String(r.list_name ?? "")]));
  const attachedListNames =
    !attachedLinksError && !attachedListsError
      ? attachedListIds.map((id) => nameById.get(id) ?? "Candidate list").filter(Boolean)
      : [];

  const { data: callConfig, error: callConfigError } = await supabase
    .from("call_configurations")
    .select("id")
    .eq("campaign_id", id)
    .maybeSingle();
  const callsConfigured = !callConfigError && Boolean(callConfig?.id);

  const activeSessionStatuses: string[] = ["queued", "running", "paused"];
  const { data: activeSession, error: activeSessionError } = await supabase
    .from("campaign_call_sessions")
    .select("id,status,total_candidates,started_at,completed_at,created_at")
    .eq("campaign_id", id)
    .in("status", activeSessionStatuses)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestSession, error: latestSessionError } = !activeSession?.id
    ? await supabase
        .from("campaign_call_sessions")
        .select("id,status,total_candidates,started_at,completed_at,created_at")
        .eq("campaign_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };

  const callSession = activeSession?.id ? activeSession : latestSession;

  return (
    <AppShell>
      <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <Link
                href="/campaigns"
                className="font-medium text-zinc-700 hover:text-zinc-900"
              >
                Campaigns
              </Link>
              <span aria-hidden="true">/</span>
              <span className="truncate text-zinc-500">{campaign.campaignName}</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                {campaign.campaignName}
              </h1>
              <span
                className={[
                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                  statusPill(campaign.status),
                ].join(" ")}
              >
                {campaign.status}
              </span>
            </div>

            <p className="mt-1 text-sm text-zinc-600">{campaign.jobTitle}</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <DuplicateCampaignAction campaignId={campaign.id} />
            <CampaignDeleteAction campaignId={campaign.id} campaignName={campaign.campaignName} />
          </div>
        </div>
      </header>

      <section className="mt-6">
        <CampaignWorkflow
          campaignId={campaign.id}
          status={campaign.status}
          candidateCount={campaign.candidateCount}
          callsConfigured={callsConfigured}
          editInitial={{
            campaignName: campaign.campaignName,
            jobTitle: campaign.jobTitle,
            jobDescription: campaign.jobDescription,
            requiredSkills: campaign.requiredSkills,
            employmentType: campaign.employmentType,
          }}
          attachedListNames={attachedListNames}
          hasCallSession={Boolean(callSession?.id) && !(activeSessionError ?? latestSessionError)}
          callSessionStatus={callSession?.id ? String(callSession.status ?? "") : null}
        />
      </section>

      <section className="mt-6 grid gap-3 lg:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 transition hover:shadow-md lg:col-span-2 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Job description</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Role context used for matching and outreach.
              </p>
            </div>
            <span
              className={[
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                statusPill(campaign.status),
              ].join(" ")}
            >
              {campaign.status}
            </span>
          </div>

          <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {campaign.jobDescription}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-zinc-900">Required skills</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.length ? (
                skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200/80"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-sm text-zinc-600">No skills set</span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 transition hover:shadow-md sm:p-7">
          <h2 className="text-sm font-semibold text-zinc-900">Details</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Employment type
              </div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">
                {campaign.employmentType}
              </div>
            </div>

            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Candidate count
              </div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">
                {campaign.candidateCount.toLocaleString()}
              </div>
            </div>

            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Created
              </div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">
                {formatDateTime(campaign.createdAt)}
              </div>
            </div>

            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Updated
              </div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">
                {formatDateTime(campaign.updatedAt)}
              </div>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

