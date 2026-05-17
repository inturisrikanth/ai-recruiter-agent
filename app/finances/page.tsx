import { AppShell } from "@/components/dashboard/AppShell";
import { FinancesSidebar } from "@/components/dashboard/FinancesSidebar";
import { StatCard } from "@/components/dashboard/StatCard";
import type { ReactNode } from "react";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900">{title}</div>
          <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p>
        </div>
        <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200/70">
          Preview
        </span>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export default function FinancesPage() {
  return (
    <AppShell sidebar={<FinancesSidebar />}>
      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
        <div className="text-sm font-medium text-zinc-500">Finances</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Finances
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Track transactions, withdrawals, expenses, and invoices in one place.
        </p>
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-900">This month</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Net balance"
            value="$12,480"
            delta="Estimated after fees"
            badgeLabel="Updated"
            accent="indigo"
          />
          <StatCard
            label="Withdrawals"
            value="$4,200"
            delta="2 withdrawals pending"
            badgeLabel="Preview"
            accent="sky"
          />
          <StatCard
            label="Expenses"
            value="$1,320"
            delta="Mostly tools & vendors"
            badgeLabel="Preview"
            accent="amber"
          />
          <StatCard
            label="Invoices"
            value="6"
            delta="2 due this week"
            badgeLabel="Preview"
            accent="emerald"
          />
        </div>
      </section>

      <section className="mt-6 grid gap-6">
        <div id="transactions" className="scroll-mt-28">
          <SectionCard
            title="Transactions"
            description="Incoming payouts and outgoing payments (placeholder)."
          >
            <div className="overflow-hidden rounded-3xl bg-zinc-50 ring-1 ring-zinc-200/70">
              <div className="divide-y divide-zinc-200/70">
                {[
                  { label: "Payout received", amount: "+$1,560", meta: "2d ago" },
                  { label: "Vendor payment", amount: "-$220", meta: "5d ago" },
                  { label: "Payout received", amount: "+$980", meta: "1w ago" },
                ].map((t) => (
                  <div key={`${t.label}-${t.meta}`} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-900">
                          {t.label}
                        </div>
                        <div className="mt-1 text-xs font-medium text-zinc-500">
                          {t.meta}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-200/70">
                        {t.amount}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        <div id="withdrawals" className="scroll-mt-28">
          <SectionCard
            title="Withdrawals"
            description="Transfer funds to your preferred method (placeholder)."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
                <div className="text-sm font-semibold text-zinc-900">
                  Withdrawal methods
                </div>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  Add bank account, card, or other payout options.
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500"
                >
                  Add method
                </button>
              </div>
              <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
                <div className="text-sm font-semibold text-zinc-900">
                  Scheduled withdrawals
                </div>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  Automate weekly or monthly transfers to stay consistent.
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
                >
                  Configure schedule
                </button>
              </div>
            </div>
          </SectionCard>
        </div>

        <div id="expenses" className="scroll-mt-28">
          <SectionCard
            title="Expenses"
            description="Categorize spending and keep receipts (placeholder)."
          >
            <div className="grid gap-2">
              {[
                { label: "Tools & software", value: "$740", accent: "bg-sky-50 text-sky-700 ring-sky-200/70" },
                { label: "Contractors", value: "$420", accent: "bg-amber-50 text-amber-700 ring-amber-200/70" },
                { label: "Other", value: "$160", accent: "bg-zinc-100 text-zinc-700 ring-zinc-200/80" },
              ].map((e) => (
                <div
                  key={e.label}
                  className="flex items-center justify-between rounded-3xl bg-zinc-50 px-4 py-4 ring-1 ring-zinc-200/70"
                >
                  <div className="text-sm font-semibold text-zinc-900">{e.label}</div>
                  <span className={["rounded-full px-2.5 py-1 text-xs font-semibold ring-1", e.accent].join(" ")}>
                    {e.value}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div id="invoices" className="scroll-mt-28">
          <SectionCard
            title="Invoices"
            description="Generate and track invoices for hiring work (placeholder)."
          >
            <div className="overflow-hidden rounded-3xl bg-zinc-50 ring-1 ring-zinc-200/70">
              <div className="divide-y divide-zinc-200/70">
                {[
                  { id: "INV-1042", status: "Draft", amount: "$2,500" },
                  { id: "INV-1041", status: "Sent", amount: "$1,200" },
                  { id: "INV-1040", status: "Paid", amount: "$3,800" },
                ].map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-900">{inv.id}</div>
                      <div className="mt-1 text-sm text-zinc-600">{inv.status}</div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-zinc-900">
                      {inv.amount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>
      </section>
    </AppShell>
  );
}

