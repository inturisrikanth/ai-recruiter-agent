"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchResponse = {
  campaigns: Array<{ id: string; name: string; status: string; href: string }>;
  candidateLists: Array<{ id: string; name: string; href: string }>;
  candidates: Array<{ id: string; name: string; email: string | null; phone: string | null; href: string }>;
  templates: Array<{ id: string; name: string; companyName: string | null; href: string }>;
  reports: Array<{ id: string; name: string; href: string }>;
};

function inputClass() {
  return "h-11 w-[200px] rounded-full bg-white pl-10 pr-10 text-sm text-zinc-950 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 transition focus:outline-none focus:ring-2 focus:ring-indigo-500/15 md:w-[260px]";
}

function sectionTitle(label: string) {
  return <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>;
}

function Row({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl px-3 py-2 text-left hover:bg-zinc-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900">{title}</div>
          {subtitle ? <div className="mt-0.5 truncate text-xs text-zinc-600">{subtitle}</div> : null}
        </div>
      </div>
    </button>
  );
}

export function UniversalSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse>({
    campaigns: [],
    candidateLists: [],
    candidates: [],
    templates: [],
    reports: [],
  });

  const hasQuery = q.trim().length >= 2;
  const hasResults =
    data.campaigns.length ||
    data.candidateLists.length ||
    data.candidates.length ||
    data.templates.length ||
    data.reports.length;

  const abortRef = useRef<AbortController | null>(null);

  const grouped = useMemo(() => {
    return [
      { label: "Campaigns", rows: data.campaigns.map((r) => ({ ...r, subtitle: r.status ? `Status: ${r.status}` : null })) },
      { label: "Candidate Lists", rows: data.candidateLists.map((r) => ({ ...r, subtitle: null })) },
      { label: "Candidates", rows: data.candidates.map((r) => ({ ...r, subtitle: [r.email, r.phone].filter(Boolean).join(" • ") || null })) },
      { label: "Templates", rows: data.templates.map((r) => ({ ...r, subtitle: r.companyName ? `Company: ${r.companyName}` : null })) },
      { label: "Reports", rows: data.reports.map((r) => ({ ...r, subtitle: null })) },
    ];
  }, [data]);

  useEffect(() => {
    // Defer state updates to satisfy strict setState-in-effect lint.
    const t0 = window.setTimeout(() => {
      if (!hasQuery) {
        abortRef.current?.abort();
        setLoading(false);
        setError(null);
        setData({ campaigns: [], candidateLists: [], candidates: [], templates: [], reports: [] });
        return;
      }

      setLoading(true);
      setError(null);
    }, 0);

    if (!hasQuery) return () => window.clearTimeout(t0);

    const t = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: controller.signal });
        const payload = (await res.json().catch(() => null)) as (SearchResponse & { error?: string }) | null;
        if (!res.ok) throw new Error(payload?.error || "Search failed.");
        setData({
          campaigns: payload?.campaigns ?? [],
          candidateLists: payload?.candidateLists ?? [],
          candidates: payload?.candidates ?? [],
          templates: payload?.templates ?? [],
          reports: payload?.reports ?? [],
        });
      } catch (e) {
        if ((e as { name?: string } | null)?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Search failed.");
        setData({ campaigns: [], candidateLists: [], candidates: [], templates: [], reports: [] });
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t);
    };
  }, [q, hasQuery]);

  useEffect(() => {
    if (!open) return;
    const opts = { capture: true } as const;
    function onPointerDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      inputRef.current?.blur();
    }
    window.addEventListener("mousedown", onPointerDown, opts);
    window.addEventListener("keydown", onKeyDown, opts);
    return () => {
      window.removeEventListener("mousedown", onPointerDown, opts);
      window.removeEventListener("keydown", onKeyDown, opts);
    };
  }, [open]);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative w-[200px] md:w-[260px]">
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
          <path d="M16.2 16.2 21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search"
          className={inputClass()}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-200/80">
          ⌘K
        </span>
      </label>

      {open ? (
        <div className="absolute left-0 mt-2 w-full max-h-[420px] overflow-y-auto overscroll-contain rounded-3xl bg-white shadow-xl ring-1 ring-zinc-200/70">
          <div className="p-2">
            {!hasQuery ? (
              <div className="px-3 py-6 text-sm text-zinc-600">Type at least 2 characters to search.</div>
            ) : loading ? (
              <div className="px-3 py-6 text-sm text-zinc-600">Searching…</div>
            ) : error ? (
              <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200/70">{error}</div>
            ) : !hasResults ? (
              <div className="px-3 py-6 text-sm text-zinc-600">No results found.</div>
            ) : (
              <div className="grid gap-2">
                {grouped.map((g) => {
                  if (!g.rows.length) return null;
                  return (
                    <div key={g.label} className="overflow-hidden rounded-2xl ring-1 ring-zinc-200/70">
                      {sectionTitle(g.label)}
                      <div className="grid gap-1 px-1 pb-2">
                        {g.rows.map((r) => (
                          <Row
                            key={r.id}
                            title={r.name}
                            subtitle={(r as { subtitle?: string | null }).subtitle ?? null}
                            onClick={() => navigate((r as { href: string }).href)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

