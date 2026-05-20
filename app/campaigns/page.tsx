import { AppShell } from "@/components/dashboard/AppShell";
import { CampaignsManager, type Campaign } from "@/components/campaigns/CampaignsManager";
import { supabase } from "@/lib/supabaseClient";

// Ensure fresh data in production (avoid static/cached HTML).
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
  if (value === "Full-time" || value === "Part-time" || value === "Contract" || value === "Internship") {
    return value;
  }
  return "Full-time";
}

export default async function CampaignsPage() {
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id,campaign_name,job_title,job_description,required_skills,employment_type,status,candidate_count,created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-medium text-zinc-500">Campaigns</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Campaigns
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Create, monitor, and optimize sourcing and outreach for each role.
          </p>
        </div>

        <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
          <div className="text-sm font-semibold text-rose-900">
            Couldn’t load campaigns
          </div>
          <div className="mt-1 text-sm text-rose-800">{error.message}</div>
          <div className="mt-3 text-sm text-rose-800">
            Try refreshing the page.
          </div>
        </div>
      </AppShell>
    );
  }

  const campaigns: Campaign[] = (data ?? []).map((row) => ({
    id: String(row.id),
    campaignName: String(row.campaign_name),
    jobTitle: String(row.job_title),
    jobDescription: String(row.job_description),
    requiredSkills: String(row.required_skills ?? ""),
    employmentType: normalizeEmploymentType(String(row.employment_type ?? "")),
    status: normalizeStatus(String(row.status ?? "Draft")),
    candidateCount: Number(row.candidate_count ?? 0),
    createdAt: String(row.created_at),
  }));

  return (
    <AppShell>
      <CampaignsManager campaigns={campaigns} />
    </AppShell>
  );
}

