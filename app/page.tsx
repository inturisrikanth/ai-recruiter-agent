import { AppShell } from "@/components/dashboard/AppShell";
import { StatCard } from "@/components/dashboard/StatCard";
import Link from "next/link";

export default function Home() {
  const stats = [
    { label: "Active campaigns", value: "8", delta: "+2 this week" },
    { label: "Candidates sourced", value: "1,284", delta: "+14% vs last week" },
    { label: "Replies", value: "312", delta: "24.3% reply rate" },
    { label: "Calls booked", value: "46", delta: "+9 this week" },
  ];

  const today = [
    {
      title: "Review top matches",
      detail: "12 new candidates scored 90+ for “Senior Full‑Stack Engineer”.",
    },
    {
      title: "Send follow‑ups",
      detail: "7 conversations are ready for a nudge to improve reply rate.",
    },
    {
      title: "Prep call notes",
      detail: "3 calls scheduled tomorrow—generate tailored question sets.",
    },
  ];

  const recentActivity = [
    {
      title: "New replies received",
      detail: "6 candidates replied across 3 active campaigns.",
      time: "2h ago",
    },
    {
      title: "Call booked",
      detail: "A 30‑min screening was scheduled for tomorrow at 11:00am.",
      time: "6h ago",
    },
    {
      title: "Campaign health improved",
      detail: "Reply rate increased by 3.1% week over week.",
      time: "Yesterday",
    },
  ];

  return (
    <AppShell
      sidebar={null}
      rightPanel={
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                For you today
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                To‑dos that require your attention.
              </p>
            </div>
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200/70">
              {today.length}
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {today.map((t) => (
              <div
                key={t.title}
                className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-900">
                      {t.title}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-zinc-600">
                      {t.detail}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <button
              type="button"
              className="inline-flex h-10 w-full items-center justify-center rounded-2xl bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500"
            >
              View my tasks
            </button>
          </div>

          <div className="mt-5 rounded-3xl bg-white p-4 ring-1 ring-zinc-200/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  Weekly health
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  Campaign performance is improving.
                </div>
              </div>
              <div className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70">
                <span className="text-sm font-semibold">A</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                <span>Reply rate</span>
                <span className="text-zinc-700">24%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-zinc-100">
                <div className="h-2 w-[66%] rounded-full bg-emerald-500" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <header className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="text-sm font-medium text-zinc-500">Overview</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Hey, Srikanth <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Here’s a quick snapshot of your recruiting activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/workspace"
            className="inline-flex h-10 items-center justify-center rounded-full bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500"
          >
            Go to workspace
          </Link>
          <Link
            href="/reports"
            className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
          >
            View reports
          </Link>
        </div>
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-900">Stats</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              delta={s.delta}
              accent={
                s.label === "Active campaigns"
                  ? "indigo"
                  : s.label === "Candidates sourced"
                    ? "sky"
                    : s.label === "Replies"
                      ? "emerald"
                      : "amber"
              }
            />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Recent activity</h2>
            <p className="mt-1 text-sm text-zinc-600">
              A quick rollup of what changed recently.
            </p>
          </div>
          <Link
            href="/workspace"
            className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            Open workspace
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70">
          <div className="divide-y divide-zinc-200/70">
            {recentActivity.map((a) => (
              <div key={a.title} className="px-4 py-4 hover:bg-zinc-50/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-900">
                      {a.title}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-zinc-600">
                      {a.detail}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs font-medium text-zinc-500">
                    {a.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-zinc-200/70 bg-white px-4 py-3 text-sm">
            <span className="text-zinc-600">
              More activity will appear here as you work in Workspace.
            </span>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
