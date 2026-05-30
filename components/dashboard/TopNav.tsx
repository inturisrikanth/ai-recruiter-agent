"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

type TopNavItem = {
  label: string;
  href: string;
  match?: (pathname: string) => boolean;
  icon: (props: { className?: string }) => ReactNode;
};

function navItemClass(active: boolean) {
  return active
    ? "group inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-semibold text-zinc-950 shadow-sm ring-1 ring-zinc-200/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
    : "group inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-zinc-700 transition-colors hover:bg-white hover:text-zinc-950 hover:shadow-sm hover:ring-1 hover:ring-zinc-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30";
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
    >
      <path
        d="M4 10.5 12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 21.5v-6A1.5 1.5 0 0 1 11 14h2a1.5 1.5 0 0 1 1.5 1.5v6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconWorkspace({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
    >
      <path
        d="M4.5 6.5A2 2 0 0 1 6.5 4.5h4A2 2 0 0 1 12.5 6.5v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M11.5 13.5h6a2 2 0 0 1 2 2v2A2 2 0 0 1 17.5 21.5h-6a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M14 6.5a2 2 0 0 1 2-2h1.5a2 2 0 0 1 2 2V10a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V6.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function IconFinances({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
    >
      <path
        d="M4.5 8.5A3 3 0 0 1 7.5 5.5h9A3 3 0 0 1 19.5 8.5v7a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4.8 10h14.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8 15.5h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const items: TopNavItem[] = [
    { label: "Home", href: "/", match: (p) => p === "/", icon: IconHome },
    {
      label: "Workspace",
      href: "/workspace",
      match: (p) =>
        p.startsWith("/workspace") ||
        p.startsWith("/campaigns") ||
        p.startsWith("/candidates") ||
        p.startsWith("/calls") ||
        p.startsWith("/outreach") ||
        p.startsWith("/reports") ||
        p.startsWith("/settings"),
      icon: IconWorkspace,
    },
    {
      label: "Finances",
      href: "/finances",
      match: (p) => p.startsWith("/finances"),
      icon: IconFinances,
    },
  ];

  return (
    <div className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/70 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/70">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-[22px] text-zinc-950"
              fill="none"
            >
              <path
                d="M12 2l8.5 4.5v6.1c0 5-3.4 9.6-8.5 9.6S3.5 17.6 3.5 12.6V6.5L12 2z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M8 12.2l2.2 2.2L16 8.8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-zinc-950">
              AI Recruiter Assistant
            </div>
            <div className="text-xs font-medium text-zinc-600">Workspace dashboard</div>
          </div>
        </Link>

        <nav aria-label="Top navigation" className="hidden items-center gap-2 sm:flex">
          {items.map((item) => {
            const active = item.match ? item.match(pathname) : pathname === item.href;
            return (
              <Link key={item.label} href={item.href} className={navItemClass(active)}>
                <item.icon
                  className={[
                    "size-5",
                    active ? "text-indigo-700" : "text-zinc-600 group-hover:text-zinc-900",
                  ].join(" ")}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex">
            <label className="relative">
              <span className="sr-only">Search</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-500"
                fill="none"
              >
                <path
                  d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M16.2 16.2 21 21"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <input
                placeholder="Search"
                className="h-11 w-[200px] rounded-full bg-white pl-10 pr-10 text-sm text-zinc-950 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 transition focus:outline-none focus:ring-2 focus:ring-indigo-500/15 md:w-[260px]"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-200/80">
                ⌘K
              </span>
            </label>
          </div>

          <button
            type="button"
            className="hidden sm:inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-zinc-950 shadow-sm ring-1 ring-zinc-200/70 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5 text-zinc-700"
              fill="none"
            >
              <path
                d="M12 3.5c2.8 0 5 2.2 5 5v2.3c0 .7.3 1.4.8 1.9l.8.8c.3.3.1.9-.3.9H5.7c-.5 0-.7-.6-.3-.9l.8-.8c.5-.5.8-1.2.8-1.9V8.5c0-2.8 2.2-5 5-5Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M9.5 18a2.5 2.5 0 0 0 5 0"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span className="hidden md:inline">Notifications</span>
            <span className="grid size-5 place-items-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
              3
            </span>
          </button>

          <details className="relative">
            <summary
              aria-label="Account"
              className="list-none [&::-webkit-details-marker]:hidden cursor-pointer"
              onClick={() => setLogoutError(null)}
            >
              <span className="grid size-11 place-items-center rounded-full bg-white shadow-sm ring-1 ring-zinc-200/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 text-zinc-800" fill="none">
                  <path
                    d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M4.5 20.2a7.5 7.5 0 0 1 15 0"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </summary>
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-zinc-200/70">
              <div className="p-2">
                <Link
                  href="/account"
                  className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                  onClick={() => setLogoutError(null)}
                >
                  Account
                  <span className="text-xs font-medium text-zinc-400">→</span>
                </Link>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                  onClick={async () => {
                    setLogoutError(null);
                    const res = await fetch("/api/auth/logout", { method: "POST" });
                    if (!res.ok) {
                      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
                      setLogoutError(payload?.error || "Couldn’t log out.");
                      return;
                    }
                    router.replace("/login");
                    router.refresh();
                  }}
                >
                  Log out
                  <span className="text-xs font-medium text-zinc-400">→</span>
                </button>
                {logoutError ? <div className="mt-2 px-3 pb-2 text-xs font-semibold text-rose-700">{logoutError}</div> : null}
              </div>
            </div>
          </details>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-4 pb-3 sm:hidden">
        <details className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/70">
          <summary className="cursor-pointer select-none list-none px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-50">
            Menu
          </summary>
          <div className="border-t border-zinc-200/70 px-2 py-2">
            <div className="grid gap-1">
              {items.map((item) => {
                const active = item.match ? item.match(pathname) : pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={[
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                      active
                        ? "bg-indigo-50 text-zinc-950 ring-1 ring-indigo-200/70"
                        : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950",
                    ].join(" ")}
                  >
                    <item.icon className="size-5 text-zinc-600" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-2 px-2">
              <label className="relative block">
                <span className="sr-only">Search</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-500"
                  fill="none"
                >
                  <path
                    d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M16.2 16.2 21 21"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  placeholder="Search"
                  className="h-11 w-full rounded-2xl bg-zinc-50 pl-10 pr-3 text-sm text-zinc-950 ring-1 ring-zinc-200/70 placeholder:text-zinc-400 transition focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                />
              </label>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

