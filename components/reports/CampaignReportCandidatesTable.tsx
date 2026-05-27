"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

type CandidateRow = {
  id: string;
  candidate_name: string;
  candidate_phone: string | null;
  candidate_email: string | null;
  interest_status: string | null;
  call_status: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type CandidateDetails = {
  id: string;
  candidate_name: string | null;
  candidate_phone: string | null;
  candidate_email: string | null;
  call_status: string | null;
  interest_status: string | null;
  attempt_count: number | null;
  max_attempts: number | null;
  call_completed_at: string | null;
  updated_at: string | null;
  created_at: string | null;
  call_summary: string | null;
  transcript: string | null;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  // Deterministic formatting for SSR + hydration:
  // - fixed locale
  // - no reliance on runtime punctuation (comma vs "at")
  // - fixed assembly order
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const month = get("month");
  const day = get("day");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = get("dayPeriod");

  // Example: "May 25, 2026, 7:06 PM"
  return `${month} ${day}, ${year}, ${hour}:${minute} ${dayPeriod}`.trim();
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function labelCallStatus(value: unknown) {
  const s = normalize(value);
  if (!s) return "—";
  if (s === "completed" || s === "done") return "Completed";
  if (s === "no_answer" || s === "no-answer" || s === "voicemail") return "No answer";
  if (s === "failed") return "Failed";
  if (s === "retry_scheduled") return "Retry scheduled";
  if (s === "callback_scheduled") return "Callback scheduled";
  if (s === "queued") return "Queued";
  if (s === "calling" || s === "running" || s === "in_progress") return "Calling";
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function interestKind(value: unknown): "interested" | "not_interested" | "unknown" {
  const s = normalize(value);
  if (!s) return "unknown";
  if (s.includes("interested") && !s.includes("not")) return "interested";
  if (s.includes("not_interested") || s.includes("not interested") || s === "no" || s === "reject") return "not_interested";
  if (s === "unknown" || s === "unsure" || s === "neutral") return "unknown";
  return "unknown";
}

function interestLabel(value: unknown) {
  const k = interestKind(value);
  if (k === "interested") return "Interested";
  if (k === "not_interested") return "Not interested";
  return "Unknown";
}

function interestPillClass(value: unknown) {
  const k = interestKind(value);
  if (k === "interested") return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
  if (k === "not_interested") return "bg-rose-50 text-rose-800 ring-rose-200/70";
  return "bg-zinc-100 text-zinc-700 ring-zinc-200/80";
}

function callPillClass(value: unknown) {
  const s = normalize(value);
  if (s === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
  if (s === "retry_scheduled" || s === "callback_scheduled") return "bg-amber-50 text-amber-800 ring-amber-200/70";
  if (s === "failed" || s === "no_answer" || s === "no-answer" || s === "voicemail") return "bg-rose-50 text-rose-800 ring-rose-200/70";
  if (s === "queued") return "bg-sky-50 text-sky-800 ring-sky-200/70";
  if (s === "calling" || s === "running" || s === "in_progress") return "bg-indigo-50 text-indigo-800 ring-indigo-200/70";
  return "bg-zinc-100 text-zinc-700 ring-zinc-200/80";
}

type Utterance = { speaker: "agent" | "candidate"; text: string };

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseTranscriptUtterances(transcript: string | null): Utterance[] {
  const raw = String(transcript ?? "").trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const utterances: Utterance[] = [];

  const speakerRegex =
    /^(agent|assistant|ai|recruiter|bot|system|caller|user|candidate|callee|human)\s*[:\-]\s*(.+)$/i;

  for (const line of lines) {
    const m = speakerRegex.exec(line);
    if (m) {
      const label = String(m[1] ?? "").toLowerCase();
      const content = cleanText(String(m[2] ?? ""));
      if (!content) continue;
      const speaker: Utterance["speaker"] =
        label === "user" || label === "candidate" || label === "callee" || label === "human" ? "candidate" : "agent";
      const prev = utterances[utterances.length - 1];
      if (prev && prev.speaker === speaker) prev.text = cleanText(`${prev.text} ${content}`);
      else utterances.push({ speaker, text: content });
      continue;
    }

    // Fallback: treat as continuation of last utterance if any, else candidate.
    const prev = utterances[utterances.length - 1];
    const content = cleanText(line);
    if (!content) continue;
    if (prev) prev.text = cleanText(`${prev.text} ${content}`);
    else utterances.push({ speaker: "candidate", text: content });
  }

  return utterances;
}

function isUsefulSummary(summary: string | null) {
  const t = String(summary ?? "").trim();
  if (!t) return false;
  if (t.length < 60) return false;
  if (t.length > 600) return false;
  const lower = t.toLowerCase();
  const signal = ["experience", "years", "rate", "salary", "available", "notice", "interested", "location", "remote", "start"].some((k) =>
    lower.includes(k),
  );
  const generic = ["the call", "this call", "the conversation", "candidate", "assistant"].some((k) => lower.startsWith(k));
  if (!signal && generic && t.length < 160) return false;
  return true;
}

function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close details"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200/70 px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Candidate details</div>
            <div className="truncate text-base font-semibold text-zinc-900">{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function CampaignReportCandidatesTable({
  campaignId,
  candidates,
}: {
  campaignId: string;
  candidates: CandidateRow[];
}) {
  const [search, setSearch] = useState("");
  const [interestFilter, setInterestFilter] = useState<"all" | "interested" | "not_interested" | "unknown">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [details, setDetails] = useState<CandidateDetails | null>(null);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      const interest = interestKind(c.interest_status);
      if (interestFilter !== "all" && interest !== interestFilter) return false;

      if (!q) return true;
      const hay = [c.candidate_name, c.candidate_phone ?? "", c.candidate_email ?? ""].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [candidates, interestFilter, search]);

  const selected = useMemo(() => candidates.find((c) => c.id === openId) ?? null, [candidates, openId]);
  const drawerTitle = selected?.candidate_name || details?.candidate_name || "Candidate";

  function filterPillClass(active: boolean) {
    return [
      "inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold ring-1 transition",
      active
        ? "bg-indigo-600 text-white ring-indigo-500/20"
        : "bg-white text-zinc-900 ring-zinc-200/70 hover:bg-zinc-50",
    ].join(" ");
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!openId) return;
      setLoading(true);
      setLoadError(null);
      setDetails(null);
      try {
        const res = await fetch(
          `/api/reports/candidate-details?candidateId=${encodeURIComponent(openId)}&campaignId=${encodeURIComponent(campaignId)}`,
          { method: "GET", cache: "no-store" },
        );
        const payload = (await res.json()) as { candidate?: CandidateDetails; error?: string };
        if (!res.ok) throw new Error(payload?.error || `Couldn’t load candidate details (HTTP ${res.status}).`);
        if (!payload?.candidate) throw new Error("Missing candidate details.");
        if (!cancelled) setDetails(payload.candidate);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Couldn’t load candidate details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [openId, campaignId]);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="candidate-search">
            Search candidates
          </label>
          <input
            id="candidate-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidates by name, phone, or email"
            className="h-11 w-full rounded-3xl bg-white px-4 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={filterPillClass(interestFilter === "all")} onClick={() => setInterestFilter("all")}>
            All
          </button>
          <button
            type="button"
            className={filterPillClass(interestFilter === "interested")}
            onClick={() => setInterestFilter("interested")}
          >
            Interested
          </button>
          <button
            type="button"
            className={filterPillClass(interestFilter === "not_interested")}
            onClick={() => setInterestFilter("not_interested")}
          >
            Not interested
          </button>
          <button
            type="button"
            className={filterPillClass(interestFilter === "unknown")}
            onClick={() => setInterestFilter("unknown")}
          >
            Unknown
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Interest</th>
                <th className="px-4 py-3">Call status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70">
              {filteredCandidates.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-900">{c.candidate_name || "Candidate"}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      Updated {c.updated_at ? formatDateTime(c.updated_at) : c.created_at ? formatDateTime(c.created_at) : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{c.candidate_phone || "—"}</td>
                  <td className="px-4 py-3 text-zinc-700">{c.candidate_email || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                        interestPillClass(c.interest_status),
                      ].join(" ")}
                    >
                      {interestLabel(c.interest_status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                        callPillClass(c.call_status),
                      ].join(" ")}
                    >
                      {labelCallStatus(c.call_status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setOpenId(c.id)}
                        className="inline-flex h-9 items-center justify-center rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500"
                      >
                        View details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredCandidates.length ? (
                <tr>
                  <td className="px-4 py-8 text-sm text-zinc-600" colSpan={6}>
                    No candidates match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer
        open={Boolean(openId)}
        onClose={() => {
          setOpenId(null);
          setDetails(null);
          setLoadError(null);
          setLoading(false);
        }}
        title={drawerTitle}
      >
        {loading ? (
          <div className="rounded-3xl bg-zinc-50 p-4 text-sm text-zinc-700 ring-1 ring-zinc-200/70">Loading…</div>
        ) : loadError ? (
          <div className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
            <div className="font-semibold text-rose-900">Couldn’t load details</div>
            <div className="mt-1">{loadError}</div>
          </div>
        ) : details ? (
          <div className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Candidate</div>
                <div className="mt-2 text-sm font-semibold text-zinc-900">{details.candidate_name || "—"}</div>
                <div className="mt-2 text-sm text-zinc-700">{details.candidate_phone || "—"}</div>
                <div className="mt-1 text-sm text-zinc-700">{details.candidate_email || "—"}</div>
              </div>

              <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Status</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                      callPillClass(details.call_status),
                    ].join(" ")}
                  >
                    {labelCallStatus(details.call_status)}
                  </span>
                  <span
                    className={[
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                      interestPillClass(details.interest_status),
                    ].join(" ")}
                  >
                    {interestLabel(details.interest_status)}
                  </span>
                </div>
                <div className="mt-3 text-sm text-zinc-700">
                  Attempts:{" "}
                  <span className="font-semibold text-zinc-900">
                    {Number(details.attempt_count ?? 0)}/{Number(details.max_attempts ?? 0) || "—"}
                  </span>
                </div>
                <div className="mt-1 text-sm text-zinc-700">
                  Last updated:{" "}
                  <span className="font-semibold text-zinc-900">
                    {details.updated_at
                      ? formatDateTime(details.updated_at)
                      : details.created_at
                        ? formatDateTime(details.created_at)
                        : "—"}
                  </span>
                </div>
              </div>
            </div>

            {isUsefulSummary(details.call_summary) ? (
              <div className="rounded-3xl bg-white p-0">
                <div className="text-sm font-semibold text-zinc-900">Call summary</div>
                <div className="mt-2 rounded-3xl bg-zinc-50 p-4 text-sm text-zinc-800 ring-1 ring-zinc-200/70 whitespace-pre-wrap">
                  {String(details.call_summary ?? "").trim()}
                </div>
              </div>
            ) : null}

            <div>
              <div className="text-sm font-semibold text-zinc-900">Transcript</div>
              <div className="mt-2 max-h-96 overflow-auto rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
                {details.transcript?.trim() ? (
                  (() => {
                    const utterances = parseTranscriptUtterances(details.transcript);
                    if (!utterances.length) {
                      return <div className="text-sm text-zinc-800 whitespace-pre-wrap">{details.transcript}</div>;
                    }
                    return (
                      <div className="grid gap-2">
                        {utterances.map((u, idx) => (
                          <div
                            key={`${u.speaker}-${idx}`}
                            className={["flex", u.speaker === "agent" ? "justify-start" : "justify-end"].join(" ")}
                          >
                            <div
                              className={[
                                "max-w-[90%] rounded-3xl px-4 py-3 text-sm ring-1",
                                u.speaker === "agent"
                                  ? "bg-white text-zinc-900 ring-zinc-200/70"
                                  : "bg-indigo-50 text-indigo-950 ring-indigo-200/70",
                              ].join(" ")}
                            >
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                {u.speaker === "agent" ? "Agent" : "Candidate"}
                              </div>
                              <div className="mt-1 whitespace-pre-wrap">{u.text}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-sm text-zinc-700">No transcript available.</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-zinc-50 p-4 text-sm text-zinc-700 ring-1 ring-zinc-200/70">
            Select a candidate to view details.
          </div>
        )}
      </Drawer>
    </>
  );
}

