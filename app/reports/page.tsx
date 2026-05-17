import { AppShell } from "@/components/dashboard/AppShell";
import { StatCard } from "@/components/dashboard/StatCard";

export default function ReportsPage() {
  return (
    <AppShell>
      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
        <div className="text-sm font-medium text-zinc-500">Reports</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Reports
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Measure sourcing quality, outreach performance, and funnel conversion.
        </p>
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-900">This week</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Outbound messages"
            value="2,140"
            delta="Automations enabled"
            badgeLabel="Preview"
            accent="indigo"
          />
          <StatCard
            label="Reply rate"
            value="24%"
            delta="+3.1% vs last week"
            badgeLabel="Preview"
            accent="sky"
          />
          <StatCard
            label="Qualified replies"
            value="138"
            delta="High intent"
            badgeLabel="Preview"
            accent="emerald"
          />
          <StatCard
            label="Calls booked"
            value="46"
            delta="+9 this week"
            badgeLabel="Preview"
            accent="amber"
          />
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
          <div className="text-sm font-semibold text-zinc-900">
            Funnel conversion (placeholder)
          </div>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            A breakdown from sourced → contacted → replied → qualified → booked.
          </p>
          <div className="mt-4 h-28 rounded-3xl bg-zinc-50 ring-1 ring-zinc-200/70" />
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
          <div className="text-sm font-semibold text-zinc-900">
            Best-performing campaigns
          </div>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            We’ll highlight which roles are trending and why.
          </p>
          <div className="mt-4 grid gap-2">
            {["Senior Full‑Stack Engineer", "Front‑End Engineer (React)"].map((c) => (
              <div
                key={c}
                className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200/70"
              >
                <span className="truncate text-sm font-medium text-zinc-900">{c}</span>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/70">
                  Trending
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

