import { AppShell } from "@/components/dashboard/AppShell";
import {
  CandidateListsManager,
  type CandidateList,
} from "@/components/candidates/CandidateListsManager";
import { supabase } from "@/lib/supabaseClient";

// Ensure fresh data in production (avoid static/cached HTML).
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getFirstQueryValue(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const campaignId = getFirstQueryValue(sp.campaignId);

  const { data, error } = await supabase
    .from("candidate_lists")
    .select("id,list_name,source_file_name,total_candidates,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-medium text-zinc-500">Candidates</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Candidates
          </h1>
          <p className="mt-1 text-sm text-zinc-600">Upload lists and manage candidate data.</p>
        </div>

        <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
          <div className="text-sm font-semibold text-rose-900">Couldn’t load candidate lists</div>
          <div className="mt-1 text-sm text-rose-800">{error.message}</div>
          <div className="mt-3 text-sm text-rose-800">Try refreshing the page.</div>
        </div>
      </AppShell>
    );
  }

  const lists: CandidateList[] = (data ?? []).map((row) => ({
    id: String(row.id),
    listName: String(row.list_name ?? "Candidate list"),
    sourceFileName: String(row.source_file_name ?? ""),
    totalCandidates: Number(row.total_candidates ?? 0),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }));

  const attachedListIds: string[] = [];
  let attachedLoadError: string | null = null;
  if (campaignId) {
    const { data: attached, error: attachedErr } = await supabase
      .from("campaign_candidate_lists")
      .select("list_id")
      .eq("campaign_id", campaignId);
    if (attachedErr) {
      attachedLoadError = attachedErr.message;
    } else {
      attachedListIds.push(...(attached ?? []).map((row) => String(row.list_id)));
    }
  }

  return (
    <AppShell>
      <CandidateListsManager
        initialLists={lists}
        campaignId={campaignId ?? null}
        initialAttachedListIds={attachedListIds}
        initialAttachedLoadError={attachedLoadError}
      />
    </AppShell>
  );
}

