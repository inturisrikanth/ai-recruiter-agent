import { AppShell } from "@/components/dashboard/AppShell";
import { FinancesSidebar } from "@/components/dashboard/FinancesSidebar";
import { StatCard } from "@/components/dashboard/StatCard";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatCount(value: number | null | undefined, fallback = "—") {
  if (value == null || Number.isNaN(value)) return fallback;
  return Number(value).toLocaleString();
}

function formatUsd(value: unknown, fallback = "—") {
  if (value == null) return fallback;
  const n = typeof value === "number" ? value : Number(String(value));
  if (Number.isNaN(n)) return fallback;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatDateTime(iso: string | null | undefined) {
  const raw = String(iso ?? "").trim();
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Card({
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
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

type CampaignUsageRow = {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  callsMade: number;
  creditsUsedEstimated: number;
};

type UserCreditsRow = {
  balance: number;
  total_purchased: number;
  total_used: number;
};

type CreditTransactionRow = {
  id: string;
  type: string;
  description: string | null;
  credits: number | null;
  amount_usd: string | number | null;
  status: string | null;
  created_at: string | null;
};

type BillingInvoiceRow = {
  id: string;
  invoice_number: string | null;
  amount_usd: string | number | null;
  credits: number | null;
  status: string | null;
  invoice_url: string | null;
  created_at: string | null;
};

export default async function FinancesPage() {
  const supabase = await createSupabaseServerClient();
  const billing = createSupabaseServiceRoleClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { count: callsMadeCount },
    { data: campaignsData },
    { data: callCandidateData },
    { data: userCreditsData },
    { data: txData },
    { data: usageTxData },
    { data: invoiceData },
  ] = await Promise.all([
    supabase
      .from("campaign_call_candidates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("call_completed_at", "is", null),
    supabase
      .from("campaigns")
      .select("id,campaign_name,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("campaign_call_candidates")
      .select("campaign_id,call_completed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50000),
    supabase
      .from("user_credits")
      .select("balance,total_purchased,total_used,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("credit_transactions")
      .select("id,type,description,credits,amount_usd,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25),
    billing
      .from("credit_transactions")
      .select("campaign_id,credits")
      .eq("user_id", user.id)
      .eq("type", "usage")
      .eq("status", "completed")
      .not("campaign_id", "is", null)
      .limit(50000),
    supabase
      .from("billing_invoices")
      .select("id,invoice_number,amount_usd,credits,status,invoice_url,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const campaigns = (campaignsData ?? []).map((c) => ({
    id: String(c.id ?? ""),
    name: String((c as { campaign_name?: unknown }).campaign_name ?? "Campaign"),
    status: String((c as { status?: unknown }).status ?? "Draft"),
  }));
  const campaignById = new Map(campaigns.filter((c) => c.id).map((c) => [c.id, c]));

  const callsMadeByCampaign = new Map<string, number>();
  for (const row of (callCandidateData ?? []) as Array<{ campaign_id: unknown; call_completed_at: unknown }>) {
    const cid = String(row.campaign_id ?? "");
    if (!cid) continue;
    const completedAt = String(row.call_completed_at ?? "").trim();
    if (!completedAt) continue;
    callsMadeByCampaign.set(cid, (callsMadeByCampaign.get(cid) ?? 0) + 1);
  }

  const creditsUsedByCampaign = new Map<string, number>();
  for (const row of (usageTxData ?? []) as Array<{ campaign_id: unknown; credits: unknown }>) {
    const cid = String(row.campaign_id ?? "");
    if (!cid) continue;
    const creditsRaw = Number(row.credits ?? 0);
    if (!Number.isFinite(creditsRaw) || creditsRaw === 0) continue;
    const used = Math.abs(creditsRaw);
    creditsUsedByCampaign.set(cid, (creditsUsedByCampaign.get(cid) ?? 0) + used);
  }

  const usageRows: CampaignUsageRow[] = Array.from(callsMadeByCampaign.entries())
    .map(([campaignId, callsMade]) => {
      const c = campaignById.get(campaignId);
      if (!c) return null;
      const creditsUsedEstimated = creditsUsedByCampaign.get(campaignId) ?? 0;
      return {
        campaignId,
        campaignName: c.name,
        campaignStatus: c.status,
        callsMade,
        creditsUsedEstimated,
      };
    })
    .filter(Boolean) as CampaignUsageRow[];

  usageRows.sort((a, b) => b.callsMade - a.callsMade);

  const creditsRow: UserCreditsRow = {
    balance: Number((userCreditsData as { balance?: unknown } | null)?.balance ?? 0),
    total_purchased: Number((userCreditsData as { total_purchased?: unknown } | null)?.total_purchased ?? 0),
    total_used: Number((userCreditsData as { total_used?: unknown } | null)?.total_used ?? 0),
  };

  const totalCallsMade = Number(callsMadeCount ?? 0);
  const creditsUsedEstimated = creditsRow.total_used;
  const creditsPurchased = creditsRow.total_purchased;
  const creditBalance = creditsRow.balance;

  const transactions = (txData ?? []).map((t) => ({
    id: String((t as { id?: unknown }).id ?? ""),
    type: String((t as { type?: unknown }).type ?? ""),
    description: (t as { description?: unknown }).description ? String((t as { description?: unknown }).description) : null,
    credits: (t as { credits?: unknown }).credits == null ? null : Number((t as { credits?: unknown }).credits),
    amount_usd: (t as { amount_usd?: unknown }).amount_usd == null ? null : (t as { amount_usd?: unknown }).amount_usd,
    status: (t as { status?: unknown }).status ? String((t as { status?: unknown }).status) : null,
    created_at: (t as { created_at?: unknown }).created_at ? String((t as { created_at?: unknown }).created_at) : null,
  })) as CreditTransactionRow[];

  const invoices = (invoiceData ?? []).map((inv) => ({
    id: String((inv as { id?: unknown }).id ?? ""),
    invoice_number: (inv as { invoice_number?: unknown }).invoice_number ? String((inv as { invoice_number?: unknown }).invoice_number) : null,
    amount_usd: (inv as { amount_usd?: unknown }).amount_usd == null ? null : (inv as { amount_usd?: unknown }).amount_usd,
    credits: (inv as { credits?: unknown }).credits == null ? null : Number((inv as { credits?: unknown }).credits),
    status: (inv as { status?: unknown }).status ? String((inv as { status?: unknown }).status) : null,
    invoice_url: (inv as { invoice_url?: unknown }).invoice_url ? String((inv as { invoice_url?: unknown }).invoice_url) : null,
    created_at: (inv as { created_at?: unknown }).created_at ? String((inv as { created_at?: unknown }).created_at) : null,
  })) as BillingInvoiceRow[];

  return (
    <AppShell sidebar={<FinancesSidebar />}>
      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
        <div className="text-sm font-medium text-zinc-500">Finances</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Credits &amp; billing
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage credits, monitor usage, and keep billing information in one place.
        </p>
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-900">Finance overview</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Credit balance"
            value={formatCount(creditBalance)}
            delta="Available credits"
            badgeLabel="Live"
            accent="indigo"
          />
          <StatCard
            label="Credits purchased"
            value={formatCount(creditsPurchased)}
            delta="Total purchased"
            badgeLabel="Live"
            accent="sky"
          />
          <StatCard
            label="Credits used"
            value={formatCount(creditsUsedEstimated)}
            delta="Total used"
            badgeLabel="Live"
            accent="amber"
          />
          <StatCard
            label="Total calls made"
            value={formatCount(totalCallsMade)}
            delta="Completed/ended call attempts"
            badgeLabel="Live"
            accent="emerald"
          />
        </div>
      </section>

      <section className="mt-6 grid gap-6">
        <div id="buy-credits" className="scroll-mt-28">
          <Card title="Buy credits" description="Add credits to run outreach calls. Payments will be available soon.">
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Buy 100 Credits" },
                { label: "Buy 500 Credits" },
                { label: "Buy 1000 Credits" },
              ].map((b) => (
                <button
                  key={b.label}
                  type="button"
                  disabled
                  className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-100 px-5 text-sm font-semibold text-zinc-500 shadow-sm ring-1 ring-zinc-200/70 cursor-not-allowed"
                >
                  {b.label} (Coming soon)
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div id="campaign-usage" className="scroll-mt-28">
          <Card title="Campaign usage" description="How credits are being used across your campaigns.">
            {usageRows.length ? (
              <div className="overflow-hidden rounded-3xl bg-zinc-50 ring-1 ring-zinc-200/70">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-white/60 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Campaign</th>
                        <th className="px-4 py-3 text-right">Calls made</th>
                        <th className="px-4 py-3 text-right">Credits used</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/70">
                      {usageRows.map((r) => (
                        <tr key={r.campaignId} className="hover:bg-white/60">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-zinc-900">{r.campaignName}</div>
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-700">{formatCount(r.callsMade)}</td>
                          <td className="px-4 py-3 text-right text-zinc-700">{formatCount(r.creditsUsedEstimated)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200/80">
                              {r.campaignStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-zinc-50 p-4 text-sm text-zinc-700 ring-1 ring-zinc-200/70">
                <div className="font-semibold text-zinc-900">No campaign usage available yet.</div>
                <div className="mt-1 text-sm text-zinc-600">Once campaigns start making calls, usage will appear here.</div>
              </div>
            )}
          </Card>
        </div>

        <div id="transaction-history" className="scroll-mt-28">
          <Card title="Transaction history" description="Credits purchases and adjustments will appear here.">
            <div className="overflow-hidden rounded-3xl bg-zinc-50 ring-1 ring-zinc-200/70">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/60 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 text-right">Credits</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/70">
                    {transactions.length ? (
                      transactions.map((t) => (
                        <tr key={t.id} className="hover:bg-white/60">
                          <td className="px-4 py-3 text-zinc-700">{formatDateTime(t.created_at)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200/80">
                              {t.type || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{t.description || "—"}</td>
                          <td className="px-4 py-3 text-right text-zinc-700">{t.credits == null ? "—" : formatCount(t.credits)}</td>
                          <td className="px-4 py-3 text-right text-zinc-700">{formatUsd(t.amount_usd)}</td>
                          <td className="px-4 py-3 text-zinc-700">{t.status || "—"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center">
                          <div className="text-sm font-semibold text-zinc-900">No transactions available yet.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>

        <div id="invoices-receipts" className="scroll-mt-28">
          <Card title="Invoices & receipts" description="Download invoices and receipts for your records.">
            <div className="overflow-hidden rounded-3xl bg-zinc-50 ring-1 ring-zinc-200/70">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/60 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Credits</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/70">
                    {invoices.length ? (
                      invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-white/60">
                          <td className="px-4 py-3 font-semibold text-zinc-900">{inv.invoice_number || "—"}</td>
                          <td className="px-4 py-3 text-right text-zinc-700">{formatUsd(inv.amount_usd)}</td>
                          <td className="px-4 py-3 text-right text-zinc-700">{inv.credits == null ? "—" : formatCount(inv.credits)}</td>
                          <td className="px-4 py-3 text-zinc-700">{inv.status || "—"}</td>
                          <td className="px-4 py-3 text-zinc-700">{formatDateTime(inv.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            {inv.invoice_url ? (
                              <a
                                href={inv.invoice_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
                              >
                                Download
                              </a>
                            ) : (
                              <span className="text-sm text-zinc-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center">
                          <div className="text-sm font-semibold text-zinc-900">No invoices available yet.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}

