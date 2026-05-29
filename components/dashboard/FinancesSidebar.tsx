"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function FinancesSidebar() {
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState<string>("");

  const items: FinancesItem[] = [
    { label: "Buy credits", href: "/finances#buy-credits", hash: "buy-credits" },
    { label: "Campaign usage", href: "/finances#campaign-usage", hash: "campaign-usage" },
    { label: "Transactions", href: "/finances#transaction-history", hash: "transaction-history" },
    { label: "Invoices", href: "/finances#invoices-receipts", hash: "invoices-receipts" },
  ];

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
                    <span aria-hidden="true" className="text-sm font-semibold">
                      {item.label.slice(0, 1)}
                    </span>
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

