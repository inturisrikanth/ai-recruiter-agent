import { AppShell } from "@/components/dashboard/AppShell";

export default async function WorkspacePage() {
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

          <ol className="mt-5 space-y-4 text-sm text-zinc-700">
            {[
              {
                title: "Step 1 — Create a Campaign",
                detail:
                  "Create a recruiting campaign and enter the job title, role details, and hiring information you want to use for outreach.",
              },
              {
                title: "Step 2 — Upload Candidates",
                detail:
                  "Add candidates manually or upload a CSV file containing candidate names, phone numbers, email addresses, and other relevant details.",
              },
              {
                title: "Step 3 — Configure Call Setup",
                detail:
                  "Define the AI caller instructions, conversation flow, screening questions, and response handling for this campaign.",
              },
              {
                title: "Step 4 — Review and Activate Outreach",
                detail:
                  "Review your campaign configuration, verify candidate counts, and start the outreach process.",
              },
              {
                title: "Step 5 — Monitor Outreach Progress",
                detail:
                  "Track call activity, candidate responses, retries, callbacks, and outreach status in real time.",
              },
              {
                title: "Step 6 — Review Reports and Results",
                detail:
                  "Analyze completed calls, candidate interest levels, transcripts, summaries, and campaign performance reports.",
              },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 grid size-6 place-items-center rounded-full bg-zinc-50 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200/80">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-zinc-900">{step.title}</div>
                  <div className="mt-1 text-sm leading-6 text-zinc-600">{step.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </AppShell>
  );
}

