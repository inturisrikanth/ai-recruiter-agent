import { AppShell } from "@/components/dashboard/AppShell";

export default function CandidatesPage() {
  return (
    <AppShell>
      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
        <div className="text-sm font-medium text-zinc-500">Candidates</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Candidates
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Review matches, move candidates through stages, and keep outreach organized.
        </p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
          <div className="text-sm font-semibold text-zinc-900">
            Pipeline (placeholder)
          </div>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            A stage-based view for New, Contacted, Replied, Interviewing, and Hired.
          </p>
          <div className="mt-4 grid gap-2">
            {["New", "Contacted", "Replied"].map((s) => (
              <div
                key={s}
                className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200/70"
              >
                <span className="text-sm font-medium text-zinc-900">{s}</span>
                <span className="text-sm font-semibold text-zinc-700">—</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
          <div className="text-sm font-semibold text-zinc-900">
            Import & enrichment
          </div>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Upload CSV, sync from ATS, and enrich profiles with AI summaries.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Import candidates
          </button>
        </div>
      </section>
    </AppShell>
  );
}

