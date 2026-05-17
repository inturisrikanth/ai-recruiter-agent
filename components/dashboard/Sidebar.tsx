"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarItem = {
  label: string;
  href: string;
  match?: (pathname: string) => boolean;
  icon: (props: { className?: string }) => React.ReactNode;
};

function itemClass(active: boolean) {
  return [
    "group relative flex items-center justify-between rounded-2xl px-3 py-3 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30",
    active
      ? "bg-indigo-50/70 text-zinc-950 shadow-sm ring-1 ring-indigo-200/70 before:absolute before:left-1 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-indigo-600"
      : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 hover:shadow-sm hover:ring-1 hover:ring-zinc-200/70",
  ].join(" ");
}

function IconCampaigns({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M8 7.5V6.3c0-1 0.8-1.8 1.8-1.8h4.4c1 0 1.8.8 1.8 1.8v1.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5.5 8.5h13c.9 0 1.5.7 1.5 1.5v8c0 .9-.7 1.5-1.5 1.5h-13c-.9 0-1.5-.7-1.5-1.5v-8c0-.9.7-1.5 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 12h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCandidates({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M8.5 10a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5.5 20a6.5 6.5 0 0 1 13 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCalls({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M7.8 4.9 9.7 6.8c.4.4.5 1 .2 1.5l-1 1.6c-.3.5-.2 1.1.1 1.6 1.3 1.9 3 3.6 4.9 4.9.5.3 1.1.4 1.6.1l1.6-1c.5-.3 1.1-.2 1.5.2l1.9 1.9c.5.5.5 1.2 0 1.7l-1 1c-.8.8-1.9 1.1-3 .8-6.8-1.8-12.1-7.1-13.9-13.9-.3-1.1 0-2.2.8-3l1-1c.5-.5 1.2-.5 1.7 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconReports({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M6 19V5.5A2 2 0 0 1 8 3.5h8A2 2 0 0 1 18 5.5V19"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 19.5h7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9 8.5h6M9 12h6M9 15.5h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M19.4 13.4v-2.8l-2-.7a7.8 7.8 0 0 0-.7-1.2l.9-1.9-2-2-1.9.9c-.4-.3-.8-.5-1.2-.7l-.7-2H10.2l-.7 2c-.4.2-.8.4-1.2.7l-1.9-.9-2 2 .9 1.9c-.3.4-.5.8-.7 1.2l-2 .7v2.8l2 .7c.2.4.4.8.7 1.2l-.9 1.9 2 2 1.9-.9c.4.3.8.5 1.2.7l.7 2h2.8l.7-2c.4-.2.8-.4 1.2-.7l1.9.9 2-2-.9-1.9c.3-.4.5-.8.7-1.2l2-.7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  const workspaceItems: SidebarItem[] = [
    {
      label: "Campaigns",
      href: "/campaigns",
      match: (p) => p.startsWith("/campaigns"),
      icon: IconCampaigns,
    },
    {
      label: "Candidates",
      href: "/candidates",
      match: (p) => p.startsWith("/candidates"),
      icon: IconCandidates,
    },
    { label: "Calls", href: "/calls", match: (p) => p.startsWith("/calls"), icon: IconCalls },
    {
      label: "Reports",
      href: "/reports",
      match: (p) => p.startsWith("/reports"),
      icon: IconReports,
    },
    {
      label: "Settings",
      href: "/settings",
      match: (p) => p.startsWith("/settings"),
      icon: IconSettings,
    },
  ];

  return (
    <div className="rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70">
      <div className="border-b border-zinc-200/70 px-4 py-4">
        <div className="text-xs font-semibold text-zinc-600">Workspace</div>
      </div>

      <nav aria-label="Sidebar" className="p-2">
        <div className="grid gap-1">
          {workspaceItems.map((item) => {
            const active = item.match ? item.match(pathname) : pathname === item.href;
            return (
              <Link key={item.label} href={item.href} className={itemClass(active)}>
                <span className="flex items-center gap-2">
                  <span
                    className={[
                      "grid size-10 place-items-center rounded-2xl ring-1 transition-colors",
                      active
                        ? "bg-white text-indigo-700 shadow-sm ring-indigo-200/70"
                        : "bg-white text-zinc-700 ring-zinc-200/70 group-hover:text-zinc-950 group-hover:ring-zinc-300/70",
                    ].join(" ")}
                  >
                    <item.icon className="size-5" />
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

