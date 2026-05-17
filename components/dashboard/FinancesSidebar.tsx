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
    "group flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium",
    active
      ? "bg-indigo-50 text-indigo-900"
      : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900",
  ].join(" ");
}

export function FinancesSidebar() {
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState<string>("");

  const items: FinancesItem[] = [
    { label: "Transactions", href: "/finances#transactions", hash: "transactions" },
    { label: "Withdrawals", href: "/finances#withdrawals", hash: "withdrawals" },
    { label: "Expenses", href: "/finances#expenses", hash: "expenses" },
    { label: "Invoices", href: "/finances#invoices", hash: "invoices" },
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
        <div className="text-xs font-medium text-zinc-500">Finances</div>
      </div>

      <nav aria-label="Finances sidebar" className="p-2">
        <div className="grid gap-1">
          {items.map((item) => {
            const active =
              pathname.startsWith("/finances") &&
              (activeHash ? activeHash === item.hash : item.hash === "transactions");
            return (
              <Link key={item.label} href={item.href} className={itemClass(active)}>
                <span className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-xl bg-white ring-1 ring-zinc-200/70 text-zinc-700 group-hover:text-zinc-900">
                    <span aria-hidden="true" className="text-xs font-semibold">
                      {item.label.slice(0, 1)}
                    </span>
                  </span>
                  {item.label}
                </span>
                <span className="text-xs text-zinc-400 group-hover:text-zinc-500">
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

