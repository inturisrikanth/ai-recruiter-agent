import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

type AppShellProps = {
  children: ReactNode;
  rightPanel?: ReactNode;
  sidebar?: ReactNode | null;
};

export function AppShell({ children, rightPanel, sidebar }: AppShellProps) {
  const hasRightPanel = Boolean(rightPanel);
  const hasSidebar = sidebar !== null;
  const sidebarNode = sidebar === undefined ? <Sidebar /> : sidebar;

  return (
    <div className="min-h-screen bg-zinc-50">
      <TopNav />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
        <div
          className={[
            "grid gap-6",
            hasSidebar
              ? hasRightPanel
                ? "lg:grid-cols-[260px_1fr_340px]"
                : "lg:grid-cols-[260px_1fr]"
              : hasRightPanel
                ? "lg:grid-cols-[1fr_340px]"
                : "lg:grid-cols-[1fr]",
          ].join(" ")}
        >
          {hasSidebar ? <aside className="hidden lg:block">{sidebarNode}</aside> : null}

          <main className="min-w-0">{children}</main>

          {hasRightPanel ? <aside className="min-w-0">{rightPanel}</aside> : null}
        </div>
      </div>
    </div>
  );
}

