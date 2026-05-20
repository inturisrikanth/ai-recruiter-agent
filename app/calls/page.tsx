import { AppShell } from "@/components/dashboard/AppShell";
import { CallConfigurationForm, type CallConfigurationDraft } from "@/components/calls/CallConfigurationForm";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

// Ensure fresh data in production (avoid static/cached HTML).
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getFirstQueryValue(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function normalizeEmploymentType(value: string) {
  if (value === "Full-time" || value === "Part-time" || value === "Contract" || value === "Internship") {
    return value;
  }
  return "Full-time";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

export default async function CallsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const campaignId = getFirstQueryValue(sp.campaignId);

  if (!campaignId) {
    return (
      <AppShell>
        <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-medium text-zinc-500">Call setup</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Call setup</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Configure screening questions for AI recruiter calls.
          </p>
        </header>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-semibold text-zinc-900">Pick a campaign</div>
          <p className="mt-1 text-sm text-zinc-600">
            Open a campaign and use Step 3 “Configure calls” to set up questions.
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

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,campaign_name,job_title,employment_type,candidate_count")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError || !campaign) {
    return (
      <AppShell>
        <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-medium text-zinc-500">Call setup</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Call setup
          </h1>
          <p className="mt-1 text-sm text-zinc-600">Set up AI call behavior and screening questions.</p>
        </header>

        <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
          <div className="text-sm font-semibold text-rose-900">Couldn’t load campaign</div>
          <div className="mt-1 text-sm text-rose-800">
            {campaignError ? campaignError.message : "Campaign not found."}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/campaigns"
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
            >
              Back to Campaigns
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const { data: existing, error: configError } = await supabase
    .from("call_configurations")
    .select("company_name,selected_questions,custom_questions,call_notes")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  const initial: CallConfigurationDraft | null =
    !configError && existing
      ? {
          companyName: existing.company_name ? String(existing.company_name) : null,
          selectedQuestions: normalizeStringArray(existing.selected_questions),
          customQuestions: normalizeStringArray(existing.custom_questions),
          callNotes: existing.call_notes ? String(existing.call_notes) : null,
        }
      : null;

  return (
    <AppShell>
      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-medium text-zinc-500">Call setup</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              Call setup
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Configure what questions the AI recruiter should ask candidates during calls.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/campaigns/${encodeURIComponent(campaignId)}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
            >
              Back to campaign
            </Link>
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-3 lg:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-semibold text-zinc-900">Campaign summary</div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Campaign</div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">
                {String(campaign.campaign_name ?? "Campaign")}
              </div>
            </div>
            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Job title</div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">
                {String(campaign.job_title ?? "—")}
              </div>
            </div>
            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Employment type</div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">
                {normalizeEmploymentType(String(campaign.employment_type ?? ""))}
              </div>
            </div>
            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Candidates</div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">
                {Number(campaign.candidate_count ?? 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {configError ? (
            <div className="mb-3 rounded-3xl bg-rose-50 p-5 text-sm text-rose-800 ring-1 ring-rose-200/70 sm:p-6">
              <div className="font-semibold text-rose-900">Couldn’t load existing configuration</div>
              <div className="mt-1">{configError.message}</div>
            </div>
          ) : null}
          <CallConfigurationForm campaignId={campaignId} initial={initial} />
        </div>
      </section>
    </AppShell>
  );
}

