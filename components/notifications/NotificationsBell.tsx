"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  related_url: string | null;
  is_read: boolean;
  created_at: string | null;
  read_at: string | null;
};

function formatWhen(iso: string | null) {
  const raw = String(iso ?? "").trim();
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric" });
}

export function NotificationsBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markAllSuccess, setMarkAllSuccess] = useState(false);
  const lastLoadedAt = useRef<number>(0);
  const rootRef = useRef<HTMLDetailsElement | null>(null);

  const badge = useMemo(() => {
    if (!unreadCount || unreadCount <= 0) return null;
    return unreadCount > 99 ? "99+" : String(unreadCount);
  }, [unreadCount]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { method: "GET" });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; unreadCount?: unknown; notifications?: unknown; error?: string }
        | null;
      if (!res.ok) throw new Error(payload?.error || "Couldn’t load notifications.");
      const unread = Number(payload?.unreadCount ?? 0);
      const list = Array.isArray(payload?.notifications) ? (payload?.notifications as NotificationRow[]) : [];
      setUnreadCount(Number.isFinite(unread) ? unread : 0);
      setRows(list);
      lastLoadedAt.current = Date.now();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t load notifications.");
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function markAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
  }

  useEffect(() => {
    // Keep badge fresh when navigating (defer to avoid setState-in-effect lint).
    const t = setTimeout(() => {
      load().catch(() => null);
    }, 0);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const stale = Date.now() - lastLoadedAt.current > 10_000;
    if (!stale) return;
    const t = setTimeout(() => {
      load().catch(() => null);
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const opts = { capture: true } as const;
    function onPointerDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown, opts);
    return () => window.removeEventListener("mousedown", onPointerDown, opts);
  }, [open]);

  return (
    <details
      ref={rootRef}
      className="relative"
      open={open}
      onToggle={(e) => {
        const next = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(next);
      }}
    >
      <summary
        aria-label="Notifications"
        className="list-none [&::-webkit-details-marker]:hidden cursor-pointer"
        onClick={() => setError(null)}
      >
        <span className="relative inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-zinc-950 shadow-sm ring-1 ring-zinc-200/70 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 text-zinc-600" fill="none">
            <path
              d="M12 3.5c2.8 0 5 2.2 5 5v2.3c0 .7.3 1.4.8 1.9l.8.8c.3.3.1.9-.3.9H5.7c-.5 0-.7-.6-.3-.9l.8-.8c.5-.5.8-1.2.8-1.9V8.5c0-2.8 2.2-5 5-5Z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="hidden md:inline">Notifications</span>
          {badge ? (
            <span className="grid size-5 place-items-center rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200/70">
              {badge}
            </span>
          ) : null}
        </span>
      </summary>

      <div className="absolute right-0 mt-2 w-[360px] max-w-[90vw] overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-zinc-200/70">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200/70 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Notifications</div>
          <button
            type="button"
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
            onClick={async () => {
              setMarkAllSuccess(false);
              const hadUnread = rows.some((r) => !r.is_read);
              await markAllRead();
              await load();
              if (hadUnread) {
                setMarkAllSuccess(true);
                window.setTimeout(() => setMarkAllSuccess(false), 2200);
              }
            }}
            disabled={loading || rows.length === 0}
          >
            Mark all as read
          </button>
        </div>

        <div className="max-h-[420px] overflow-auto p-2">
          {markAllSuccess ? (
            <div className="mb-2 flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200/70">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 text-emerald-700" fill="none">
                <path
                  d="M20 6.5 9.5 17 4 11.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-semibold">All caught up</span>
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200/70">{error}</div>
          ) : null}

          {loading && !rows.length ? (
            <div className="px-3 py-6 text-sm text-zinc-600">Loading…</div>
          ) : rows.length ? (
            <div className="grid gap-1">
              {rows.map((n) => {
                const isRead = Boolean(n.is_read);
                const href = n.related_url ? String(n.related_url) : null;
                const row = (
                  <div
                    className={[
                      "rounded-2xl px-3 py-3 ring-1 transition",
                      isRead ? "bg-white ring-zinc-200/70 hover:bg-zinc-50" : "bg-indigo-50/60 ring-indigo-200/70 hover:bg-indigo-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-900">{n.title}</div>
                        <div className="mt-1 text-sm leading-5 text-zinc-600">{n.message}</div>
                      </div>
                      <div className="shrink-0 text-xs font-medium text-zinc-500">{formatWhen(n.created_at)}</div>
                    </div>
                  </div>
                );

                const onClick = async () => {
                  if (!isRead) await markRead(n.id);
                  setOpen(false);
                  if (href) {
                    router.push(href);
                    router.refresh();
                  } else {
                    await load();
                  }
                };

                return href ? (
                  <button key={n.id} type="button" onClick={onClick} className="text-left">
                    {row}
                  </button>
                ) : (
                  <button key={n.id} type="button" onClick={onClick} className="text-left">
                    {row}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-8 text-sm text-zinc-600">
              No notifications yet.{" "}
              <Link href="/finances" className="font-semibold text-zinc-800 hover:text-zinc-950" onClick={() => setOpen(false)}>
                View finances
              </Link>
              .
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

