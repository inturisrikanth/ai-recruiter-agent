import { CampaignActivateButton } from "@/components/campaigns/CampaignActivateButton";
import { AppShell } from "@/components/dashboard/AppShell";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { notFound } from "next/navigation";

// Ensure fresh data in production (avoid cached RSC/HTML).
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CampaignStatus = "Draft" | "Ready" | "Calling" | "Completed";
type EmploymentType = "Full-time" | "Part-time" | "Contract" | "Internship";

function normalizeEmploymentType(value: string): EmploymentType {
  if (value === "Full-time" || value === "Part-time" || value === "Contract" || value === "Internship") {
    return value;
  }
  return "Full-time";
}

function normalizeStatus(value: string): CampaignStatus {
  if (value === "Ready" || value === "Calling" || value === "Completed" || value === "Draft") return value;
  // Legacy / unknown statuses (e.g. Active, Paused) are treated as Draft in the MVP.
  return "Draft";
}

function parseSkills(skills: string) {
  return skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isBlank(value: unknown) {
  return String(value ?? "").trim().length === 0;
}

function readinessRow(kind: "ok" | "warn" | "todo", text: string) {
  const styles =
    kind === "ok"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200/70"
      : kind === "warn"
        ? "bg-amber-50 text-amber-900 ring-amber-200/70"
        : "bg-zinc-50 text-zinc-700 ring-zinc-200/70";
  const icon = kind === "ok" ? "✓" : kind === "warn" ? "⚠" : "•";

  return (
    <div className={["flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ring-1", styles].join(" ")}>
      <div className="mt-0.5 text-sm font-semibold" aria-hidden="true">
        {icon}
      </div>
      <div className="leading-6">{text}</div>
    </div>
  );
}

function normalizePhone(value: string) {
  return value.trim().replace(/[\s\-()]/g, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export default async function CampaignReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: campaignRow, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,campaign_name,job_title,job_description,required_skills,employment_type,status,candidate_count,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (campaignError) {
    return (
      <AppShell>
        <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
          <div className="text-sm font-medium text-zinc-500">Campaign</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Review & activate</h1>
          <p className="mt-1 text-sm text-zinc-600">Final checkpoint before AI outreach is enabled.</p>
        </header>

        <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
          <div className="text-sm font-semibold text-rose-900">Couldn’t load campaign</div>
          <div className="mt-1 text-sm text-rose-800">{campaignError.message}</div>
          <div className="mt-4">
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

  if (!campaignRow) notFound();

  const campaign = {
    id: String(campaignRow.id),
    campaignName: String(campaignRow.campaign_name ?? "Campaign"),
    jobTitle: String(campaignRow.job_title ?? ""),
    jobDescription: String(campaignRow.job_description ?? ""),
    requiredSkills: String(campaignRow.required_skills ?? ""),
    employmentType: normalizeEmploymentType(String(campaignRow.employment_type ?? "")),
    status: normalizeStatus(String(campaignRow.status ?? "Draft")),
    candidateCount: Number(campaignRow.candidate_count ?? 0),
    updatedAt: String(campaignRow.updated_at ?? ""),
  };

  const skills = parseSkills(campaign.requiredSkills);

  const { data: attachedLinks } = await supabase
    .from("campaign_candidate_lists")
    .select("list_id,created_at")
    .eq("campaign_id", id)
    .order("created_at", { ascending: true });

  const attachedListIds = (attachedLinks ?? []).map((r) => String(r.list_id));

  let attachedLists: Array<{ id: unknown; list_name: unknown; total_candidates: unknown }> = [];
  if (attachedListIds.length) {
    const { data } = await supabase
      .from("candidate_lists")
      .select("id,list_name,total_candidates")
      .in("id", attachedListIds);
    attachedLists = (data ?? []) as Array<{ id: unknown; list_name: unknown; total_candidates: unknown }>;
  }

  const lists = attachedLists.map((r) => ({
    id: String(r.id),
    name: String(r.list_name ?? "Candidate list"),
    total: Number(r.total_candidates ?? 0),
  }));

  const totalLists = lists.length;
  const totalCandidates = lists.reduce((sum, l) => sum + l.total, 0);

  const { data: callConfig } = await supabase
    .from("call_configurations")
    .select("company_name,selected_questions,custom_questions,call_notes")
    .eq("campaign_id", id)
    .maybeSingle();

  const companyName = String(callConfig?.company_name ?? "").trim();
  const selectedQuestions = Array.isArray(callConfig?.selected_questions)
    ? callConfig?.selected_questions.map((q: unknown) => String(q ?? "").trim()).filter(Boolean)
    : [];
  const customQuestions = Array.isArray(callConfig?.custom_questions)
    ? callConfig?.custom_questions.map((q: unknown) => String(q ?? "").trim()).filter(Boolean)
    : [];
  const callNotes = String(callConfig?.call_notes ?? "").trim();

  const hasCampaignDetails =
    !isBlank(campaign.campaignName) &&
    !isBlank(campaign.jobTitle) &&
    !isBlank(campaign.jobDescription) &&
    !isBlank(campaign.requiredSkills) &&
    !isBlank(campaign.employmentType);
  const hasCandidates = totalLists > 0 && totalCandidates > 0;
  const hasCallConfig = Boolean(companyName) && (selectedQuestions.length > 0 || customQuestions.length > 0 || callNotes.length > 0);

  // Lightweight warnings (best-effort).
  let missingPhoneCount: number | null = null;
  let missingEmailCount: number | null = null;
  let duplicateKeyCount: number | null = null;
  let duplicateBasedOn: number | null = null;

  if (attachedListIds.length) {
    const [{ count: phoneNull }, { count: phoneEmpty }, { count: emailNull }, { count: emailEmpty }] = await Promise.all([
      supabase
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .in("list_id", attachedListIds)
        .is("phone", null),
      supabase
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .in("list_id", attachedListIds)
        .eq("phone", ""),
      supabase
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .in("list_id", attachedListIds)
        .is("email", null),
      supabase
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .in("list_id", attachedListIds)
        .eq("email", ""),
    ]);

    missingPhoneCount = Number(phoneNull ?? 0) + Number(phoneEmpty ?? 0);
    missingEmailCount = Number(emailNull ?? 0) + Number(emailEmpty ?? 0);

    const { data: sampleCandidates } = await supabase
      .from("candidates")
      .select("phone,email")
      .in("list_id", attachedListIds)
      .limit(5000);

    const seen = new Set<string>();
    let dupCount = 0;
    const rows = (sampleCandidates ?? []) as Array<{ phone: unknown; email: unknown }>;
    for (const r of rows) {
      const phone = normalizePhone(String(r.phone ?? ""));
      const email = normalizeEmail(String(r.email ?? ""));
      const key = phone ? `p:${phone}` : email ? `e:${email}` : null;
      if (!key) continue;
      if (seen.has(key)) dupCount += 1;
      else seen.add(key);
    }
    duplicateKeyCount = dupCount;
    duplicateBasedOn = rows.length;
  }

  const allQuestions = [...selectedQuestions, ...customQuestions].filter(Boolean);

  const canActivate = campaign.status === "Draft" && hasCampaignDetails && hasCandidates && hasCallConfig;
  const activateDisabledReason =
    campaign.status !== "Draft"
      ? `Campaign is already ${campaign.status}.`
      : !hasCampaignDetails
        ? "Complete campaign details first."
        : !hasCandidates
          ? "Attach candidate lists first."
          : !hasCallConfig
            ? "Complete call configuration first."
            : null;

  return (
    <AppShell>
      <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <Link href={`/campaigns/${encodeURIComponent(campaign.id)}`} className="font-medium text-zinc-700 hover:text-zinc-900">
                Campaign
              </Link>
              <span aria-hidden="true">/</span>
              <span className="truncate text-zinc-500">Review & activate</span>
            </div>
            <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              Review & activate
            </h1>
            <p className="mt-1 text-sm text-zinc-600">Final checkpoint before AI outreach is enabled.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/campaigns/${encodeURIComponent(campaign.id)}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
            >
              Back to campaign
            </Link>
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-3 lg:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7 lg:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-900">Campaign summary</h2>
          <p className="mt-1 text-sm text-zinc-600">Confirm the role context the AI will reference in outreach.</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Campaign</div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">{campaign.campaignName}</div>
            </div>
            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Job title</div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">{campaign.jobTitle || "—"}</div>
            </div>
            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Employment type</div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">{campaign.employmentType}</div>
            </div>
            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Status</div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">{campaign.status}</div>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Skills</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.length ? (
                skills.map((s) => (
                  <span key={s} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200/80">
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-sm text-zinc-600">No skills set</span>
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Job description</div>
            <div className="mt-3 whitespace-pre-wrap rounded-3xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-700 ring-1 ring-zinc-200/70">
              {campaign.jobDescription || "—"}
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
          <h2 className="text-sm font-semibold text-zinc-900">Readiness checks</h2>
          <p className="mt-1 text-sm text-zinc-600">Quick signals before you activate outreach.</p>

          <div className="mt-5 grid gap-2">
            {readinessRow(hasCampaignDetails ? "ok" : "todo", "Campaign details completed")}
            {readinessRow(hasCandidates ? "ok" : "todo", "Candidate lists attached")}
            {readinessRow(hasCallConfig ? "ok" : "todo", "Call configuration completed")}
            {missingEmailCount !== null && missingEmailCount > 0
              ? readinessRow("warn", `${missingEmailCount.toLocaleString()} candidates missing email addresses`)
              : null}
            {missingPhoneCount !== null && missingPhoneCount > 0
              ? readinessRow("warn", `${missingPhoneCount.toLocaleString()} candidates missing phone numbers`)
              : null}
            {duplicateKeyCount !== null && duplicateKeyCount > 0
              ? readinessRow(
                  "warn",
                  `${duplicateKeyCount.toLocaleString()} duplicate phone/email warning${duplicateKeyCount === 1 ? "" : "s"} detected${duplicateBasedOn ? ` (based on first ${duplicateBasedOn.toLocaleString()} candidates)` : ""}`,
                )
              : null}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-3 lg:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
          <h2 className="text-sm font-semibold text-zinc-900">Candidate summary</h2>
          <p className="mt-1 text-sm text-zinc-600">Attached lists that will be contacted once outreach starts.</p>

          <div className="mt-5 grid gap-3">
            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Lists attached</div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">{totalLists.toLocaleString()}</div>
            </div>
            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Total candidates</div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">
                {totalCandidates.toLocaleString()}{" "}
                <span className="text-xs font-medium text-zinc-500">(campaign shows {campaign.candidateCount.toLocaleString()})</span>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">List names</div>
            <div className="mt-3 grid gap-2">
              {lists.length ? (
                lists.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-zinc-200/70">
                    <div className="min-w-0 font-semibold text-zinc-900">{l.name}</div>
                    <div className="shrink-0 text-xs font-semibold text-zinc-600">{l.total.toLocaleString()}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-zinc-50 p-4 text-sm text-zinc-600 ring-1 ring-zinc-200/70">
                  No candidate lists attached yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7 lg:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-900">Call configuration summary</h2>
          <p className="mt-1 text-sm text-zinc-600">What the AI will say and ask on screening calls.</p>

          <div className="mt-5 grid gap-3">
            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Company</div>
              <div className="mt-2 text-sm font-semibold text-zinc-900">{companyName || "—"}</div>
            </div>

            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Screening questions</div>
              <div className="mt-3 grid gap-2">
                {allQuestions.length ? (
                  allQuestions.map((q, idx) => (
                    <div key={`${idx}-${q}`} className="rounded-2xl bg-white px-4 py-3 text-sm text-zinc-800 ring-1 ring-zinc-200/70">
                      {q}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-600">—</div>
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Call notes</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{callNotes || "—"}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Activation</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Activating marks the campaign as ready for outreach. Calls will not start automatically in this MVP.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <CampaignActivateButton campaignId={campaign.id} disabled={!canActivate} disabledReason={activateDisabledReason} />
        </div>
      </section>
    </AppShell>
  );
}

