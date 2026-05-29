import { AppShell } from "@/components/dashboard/AppShell";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Ensure fresh data in production (avoid cached RSC/HTML).
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CandidateRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

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

export default async function CandidateListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const { data: list, error: listError } = await supabase
    .from("candidate_lists")
    .select("id,list_name,source_file_name,total_candidates,created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (listError) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
          <div className="text-sm font-medium text-zinc-500">Candidates</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Candidate list
          </h1>
          <p className="mt-1 text-sm text-zinc-600">View candidates in this list.</p>
        </div>

        <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
          <div className="text-sm font-semibold text-rose-900">Couldn’t load candidate list</div>
          <div className="mt-1 text-sm text-rose-800">{listError.message}</div>
          <div className="mt-4">
            <Link
              href="/candidates"
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
            >
              Back to Candidates
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!list) notFound();

  const listName = String(list.list_name ?? "Candidate list");
  const sourceFileName = String(list.source_file_name ?? "");
  const totalCandidates = Number(list.total_candidates ?? 0);
  const createdAt = String(list.created_at ?? new Date().toISOString());

  const { data: candidatesData, error: candidatesError } = await supabase
    .from("candidates")
    .select("id,name,phone,email")
    .eq("list_id", id)
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  const candidates: CandidateRow[] = (candidatesData ?? []).map((c) => ({
    id: String(c.id),
    name: String(c.name ?? ""),
    phone: String(c.phone ?? ""),
    email: String(c.email ?? ""),
  }));

  return (
    <AppShell>
      <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <Link href="/candidates" className="font-medium text-zinc-700 hover:text-zinc-900">
                Candidates
              </Link>
              <span aria-hidden="true">/</span>
              <span className="truncate text-zinc-500">{listName}</span>
            </div>

            <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              {listName}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {totalCandidates.toLocaleString()} candidates • Created {formatDateTime(createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {sourceFileName ? (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200/80">
                {sourceFileName}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {candidatesError ? (
        <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
          <div className="text-sm font-semibold text-rose-900">Couldn’t load candidates</div>
          <div className="mt-1 text-sm text-rose-800">{candidatesError.message}</div>
        </div>
      ) : (
        <section className="mt-6">
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/70">
                  {candidates.length ? (
                    candidates.map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-50/60">
                        <td className="px-4 py-3 font-medium text-zinc-900">{c.name || "—"}</td>
                        <td className="px-4 py-3 text-zinc-700">{c.phone || "—"}</td>
                        <td className="px-4 py-3 text-zinc-700">{c.email || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center">
                        <div className="text-sm font-semibold text-zinc-900">No candidates</div>
                        <div className="mt-1 text-sm text-zinc-600">
                          This list doesn’t have any candidates yet.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}

