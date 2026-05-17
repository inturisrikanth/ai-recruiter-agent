import { AppShell } from "@/components/dashboard/AppShell";
import { supabase } from "@/lib/supabaseClient";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function WorkspacePage() {
  const { data } = await supabase
    .from("campaigns")
    .select("campaign_name,status,candidate_count,created_at")
    .order("created_at", { ascending: false })
    .limit(6);

  const campaigns = (data ?? []).map((c) => ({
    name: String(c.campaign_name ?? "Campaign"),
    status: String(c.status ?? "Draft"),
    createdAt: String(c.created_at ?? new Date().toISOString()),
  }));

  const recentActivity =
    campaigns.length > 0
      ? campaigns.slice(0, 4).map((c) => ({
          title: "Campaign created",
          detail: c.name,
          time: formatDate(c.createdAt),
        }))
      : [
          {
            title: "No recent activity",
            detail: "Create a campaign to start tracking your workflow.",
            time: "—",
          },
        ];

  return (
    <AppShell>
      <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
        <div className="text-sm font-medium text-zinc-500">Workspace</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Workspace
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage recruiting campaigns, candidates, outreach calls, and reporting from one workspace.
        </p>
      </header>

      <section className="mt-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">How it works</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Create campaigns, attach candidates, then activate outreach and review outcomes over time.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-sm font-semibold text-zinc-900">Campaigns</div>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Define roles and keep everything scoped to a campaign.
              </p>
            </div>
            <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
              <div className="text-sm font-semibold text-zinc-900">Candidates</div>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Add candidates, track stages, and prepare outreach.
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-zinc-200/70 pt-5">
            <h3 className="text-sm font-semibold text-zinc-900">Recommended workflow</h3>
            <ol className="mt-3 space-y-3 text-sm text-zinc-700">
              {[
                "Create a campaign",
                "Add candidates",
                "Activate outreach",
                "Review calls and reports",
              ].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 grid size-6 place-items-center rounded-full bg-white text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200/80">
                    {i + 1}
                  </span>
                  <span className="font-medium text-zinc-900">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Recent activity</h2>
              <p className="mt-1 text-sm text-zinc-600">
                A lightweight summary of what changed recently.
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl bg-zinc-50 ring-1 ring-zinc-200/70">
            <div className="divide-y divide-zinc-200/70">
              {recentActivity.map((a) => (
                <div key={`${a.title}-${a.time}`} className="px-4 py-4 hover:bg-white/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-900">{a.title}</div>
                      <div className="mt-1 text-sm leading-6 text-zinc-600">{a.detail}</div>
                    </div>
                    <div className="shrink-0 text-xs font-medium text-zinc-500">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

