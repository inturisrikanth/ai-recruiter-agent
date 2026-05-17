import { AppShell } from "@/components/dashboard/AppShell";

export default function CallsPage() {
  return (
    <AppShell>
      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
        <div className="text-sm font-medium text-zinc-500">Calls</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Calls
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Schedule interviews, capture call notes, and generate structured summaries.
        </p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
          <div className="text-sm font-semibold text-zinc-900">
            Upcoming calls (placeholder)
          </div>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            This will show your next interviews and who’s owning each step.
          </p>
          <div className="mt-4 rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
            <div className="text-sm font-semibold text-zinc-900">No calls yet</div>
            <div className="mt-1 text-sm text-zinc-600">
              Schedule a call from a candidate profile to see it here.
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
          <div className="text-sm font-semibold text-zinc-900">Call summaries</div>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Auto-generate notes, strengths/risks, and recommended next steps.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Generate summary
          </button>
        </div>
      </section>
    </AppShell>
  );
}

