"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type FinancesItem = {
  label: string;
  href: string;
  hash: string;
};

function itemClass(active: boolean) {
  return [
    "group relative flex items-center justify-between rounded-2xl px-3 py-3 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30",
    active
      ? "bg-indigo-50/70 text-zinc-950 shadow-sm ring-1 ring-indigo-200/70 before:absolute before:left-1 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-indigo-600"
      : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 hover:shadow-sm hover:ring-1 hover:ring-zinc-200/70",
  ].join(" ");
}

function IconBuyCredits({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M4.5 8.5A3 3 0 0 1 7.5 5.5h9A3 3 0 0 1 19.5 8.5v7a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M4.8 10h14.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.2 15.5h2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconCampaignUsage({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M6.5 19.5V8.5A3 3 0 0 1 9.5 5.5h5A3 3 0 0 1 17.5 8.5v11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 15.5v-3.8M12 15.5V9.5M15 15.5v-2.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M8 19.5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconTransactions({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M7 4.5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconInvoices({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M7 3.5h7l3 3v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3.5v3a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.5 12h7M8.5 15.5h7M8.5 19h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function FinancesSidebar() {
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState<string>("");

  const items: FinancesItem[] = [
    { label: "Buy credits", href: "/finances#buy-credits", hash: "buy-credits" },
    { label: "Campaign usage", href: "/finances#campaign-usage", hash: "campaign-usage" },
    { label: "Transactions", href: "/finances#transaction-history", hash: "transaction-history" },
    { label: "Invoices", href: "/finances#invoices-receipts", hash: "invoices-receipts" },
  ];

  const iconByHash: Record<string, (props: { className?: string }) => ReactNode> = {
    "buy-credits": IconBuyCredits,
    "campaign-usage": IconCampaignUsage,
    "transaction-history": IconTransactions,
    "invoices-receipts": IconInvoices,
  };

  useEffect(() => {
    const sync = () => setActiveHash(window.location.hash.replace("#", ""));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <div className="rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70">
      <div className="border-b border-zinc-200/70 px-4 py-4">
        <div className="text-xs font-semibold text-zinc-600">Finances</div>
      </div>

      <nav aria-label="Finances sidebar" className="p-2">
        <div className="grid gap-1">
          {items.map((item) => {
            const active =
              pathname.startsWith("/finances") &&
              (activeHash ? activeHash === item.hash : item.hash === "buy-credits");
            return (
              <Link key={item.label} href={item.href} className={itemClass(active)}>
                <span className="flex items-center gap-2">
                  <span
                    className={[
                      "grid size-10 place-items-center rounded-2xl bg-white ring-1 transition-colors",
                      active
                        ? "text-indigo-700 shadow-sm ring-indigo-200/70"
                        : "text-zinc-700 ring-zinc-200/70 group-hover:text-zinc-950 group-hover:ring-zinc-300/70",
                    ].join(" ")}
                  >
                    {(() => {
                      const Icon = iconByHash[item.hash] ?? IconBuyCredits;
                      return <Icon className="size-5" />;
                    })()}
                  </span>
                  {item.label}
                </span>
                <span className="text-xs font-medium text-zinc-400 transition-colors group-hover:text-zinc-600">
                  →
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

