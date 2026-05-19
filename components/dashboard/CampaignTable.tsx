import Link from "next/link";

export type CampaignStatus = "Draft" | "Ready" | "Calling" | "Completed";

export type CampaignRow = {
  name: string;
  team: string;
  status: CampaignStatus;
  candidates: number;
  replyRate: string;
  updated: string;
};

type CampaignTableProps = {
  campaigns: CampaignRow[];
  caption?: string;
};

function statusClass(status: CampaignStatus) {
  if (status === "Completed") return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
  if (status === "Calling") return "bg-indigo-50 text-indigo-800 ring-indigo-200/70";
  if (status === "Ready") return "bg-sky-50 text-sky-800 ring-sky-200/70";
  return "bg-zinc-100 text-zinc-700 ring-zinc-200/80";
}

export function CampaignTable({
  campaigns,
  caption = "Track activity and performance at a glance.",
}: CampaignTableProps) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Recent campaigns</h2>
          <p className="mt-1 text-sm text-zinc-600">{caption}</p>
        </div>
        <Link
          href="/reports"
          className="hidden text-sm font-medium text-zinc-700 hover:text-zinc-900 sm:inline"
        >
          See reports
        </Link>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Candidates</th>
                <th className="px-4 py-3 text-right">Reply rate</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70">
              {campaigns.map((c) => (
                <tr key={c.name} className="hover:bg-zinc-50/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-900">{c.name}</div>
                    <div className="text-xs text-zinc-500">AI outreach enabled</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{c.team}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                        statusClass(c.status),
                      ].join(" ")}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900">
                    {c.candidates.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900">
                    {c.replyRate}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{c.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-200/70 bg-white px-4 py-3 text-sm">
          <div className="text-zinc-600">
            Showing {Math.min(5, campaigns.length)} of {campaigns.length} campaigns
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-full bg-white px-3 text-sm font-medium text-zinc-900 ring-1 ring-zinc-200/70 hover:bg-zinc-50"
            >
              Previous
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

