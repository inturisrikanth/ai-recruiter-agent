"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type CampaignStatus = "Draft" | "Ready" | "Calling" | "Completed";
type EmploymentType = "Full-time" | "Part-time" | "Contract" | "Internship";

export type Campaign = {
  id: string;
  campaignName: string;
  jobTitle: string;
  status: CampaignStatus;
  candidateCount: number;
  createdAt: string; // ISO
  jobDescription: string;
  requiredSkills: string;
  employmentType: EmploymentType;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function parseSkills(skills: string) {
  return skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function statusPill(status: CampaignStatus) {
  switch (status) {
    case "Completed":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
    case "Calling":
      return "bg-indigo-50 text-indigo-800 ring-indigo-200/70";
    case "Ready":
      return "bg-sky-50 text-sky-800 ring-sky-200/70";
    case "Draft":
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200/80";
  }
}

function ModalShell({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center bg-zinc-900/30 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-xl ring-1 ring-zinc-200/70">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200/70 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900">{title}</div>
            {description ? (
              <div className="mt-1 text-sm text-zinc-600">{description}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-zinc-700 ring-1 ring-zinc-200/70 hover:bg-zinc-50 hover:text-zinc-900"
            aria-label="Close"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none">
              <path
                d="M7 7l10 10M17 7 7 17"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-zinc-900">{label}</span>
        {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
      </div>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function inputClass() {
  return "h-11 w-full rounded-2xl bg-white px-4 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";
}

function textareaClass() {
  return "min-h-[120px] w-full resize-y rounded-2xl bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";
}

function selectClass() {
  return "h-11 w-full rounded-2xl bg-white px-4 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";
}

export function CampaignsManager({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "All">("All");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter((c) => {
      const matchesStatus = statusFilter === "All" ? true : c.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        c.campaignName.toLowerCase().includes(q) ||
        c.jobTitle.toLowerCase().includes(q) ||
        c.requiredSkills.toLowerCase().includes(q)
      );
    });
  }, [campaigns, query, statusFilter]);

  const stats = useMemo(() => {
    const total = campaigns.length;
    const ready = campaigns.filter((c) => c.status === "Ready").length;
    const drafts = campaigns.filter((c) => c.status === "Draft").length;
    const candidates = campaigns.reduce((sum, c) => sum + c.candidateCount, 0);
    return { total, ready, drafts, candidates };
  }, [campaigns]);

  return (
    <div>
      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-medium text-zinc-500">Campaigns</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              Campaigns
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Manage campaigns, track pipeline volume, and iterate on role briefs.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              Create Campaign
            </button>
          </div>
        </div>
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-900">Campaign stats</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total campaigns"
            value={stats.total.toLocaleString()}
            delta="Across all statuses"
            badgeLabel="Updated"
            accent="indigo"
          />
          <StatCard
            label="Ready"
            value={stats.ready.toLocaleString()}
            delta="Ready for activation"
            badgeLabel="Preview"
            accent="sky"
          />
          <StatCard
            label="Candidates"
            value={stats.candidates.toLocaleString()}
            delta="Sourced in total"
            badgeLabel="Preview"
            accent="sky"
          />
          <StatCard
            label="Drafts"
            value={stats.drafts.toLocaleString()}
            delta="Ready to launch"
            badgeLabel="Preview"
            accent="amber"
          />
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Campaign list</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Search by campaign name, job title, or skills.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative">
              <span className="sr-only">Search</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search campaigns"
                className="h-11 w-full min-w-[260px] rounded-full bg-white pl-9 pr-4 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {(["All", "Draft", "Ready", "Calling", "Completed"] as const).map((s) => {
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={[
                      "inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold ring-1 transition",
                      active
                        ? "bg-indigo-50 text-indigo-900 ring-indigo-200/70"
                        : "bg-white text-zinc-700 ring-zinc-200/70 hover:bg-zinc-50 hover:text-zinc-900",
                    ].join(" ")}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Job title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Candidates</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70">
                {filtered.map((c) => {
                  const chips = parseSkills(c.requiredSkills);

                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-900">
                          {c.campaignName}
                        </div>
                        {chips.length ? (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {chips.slice(0, 3).map((s) => (
                              <span
                                key={s}
                                className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700 ring-1 ring-zinc-200/80"
                              >
                                {s}
                              </span>
                            ))}
                            {chips.length > 3 ? (
                              <span className="text-[11px] font-medium text-zinc-500">
                                +{chips.length - 3}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-zinc-500">
                            No skills set
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        <div className="font-medium text-zinc-900">{c.jobTitle}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {c.employmentType}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                            statusPill(c.status),
                          ].join(" ")}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                        {c.candidateCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {formatDate(c.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/campaigns/${c.id}`}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-sky-50 px-3 text-sm font-semibold text-sky-800 shadow-sm ring-1 ring-sky-200/70 transition hover:bg-sky-100 hover:shadow-md"
                        >
                          Open
                          <span aria-hidden="true" className="text-sky-600">
                            →
                          </span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-zinc-600" colSpan={6}>
                      {campaigns.length === 0
                        ? "No campaigns yet. Create your first campaign to get started."
                        : "No campaigns match your filters."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 border-t border-zinc-200/70 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="text-zinc-600">
              Showing {filtered.length.toLocaleString()} of {campaigns.length.toLocaleString()} campaigns
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-full bg-white px-3 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-200/70 hover:bg-zinc-50"
              >
                Previous
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-full bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      {isCreateOpen ? (
        <CreateCampaignModal
          onClose={() => setIsCreateOpen(false)}
          isCreating={isCreating}
          error={createError}
          onCreate={async (draft, reset) => {
            setIsCreating(true);
            setCreateError(null);

            const { error } = await supabase.from("campaigns").insert({
              campaign_name: draft.campaignName.trim(),
              job_title: draft.jobTitle.trim(),
              job_description: draft.jobDescription.trim(),
              required_skills: draft.requiredSkills.trim(),
              employment_type: draft.employmentType,
              status: "Draft",
              candidate_count: 0,
            });

            if (error) {
              setCreateError(error.message);
              setIsCreating(false);
              return;
            }

            reset();
            setIsCreateOpen(false);
            setIsCreating(false);
            setStatusFilter("All");
            setQuery("");
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function CreateCampaignModal({
  onClose,
  onCreate,
  isCreating,
  error,
}: {
  onClose: () => void;
  isCreating: boolean;
  error: string | null;
  onCreate: (
    draft: {
      campaignName: string;
      jobTitle: string;
      jobDescription: string;
      requiredSkills: string;
      employmentType: EmploymentType;
    },
    reset: () => void,
  ) => void | Promise<void>;
}) {
  const [campaignName, setCampaignName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("Full-time");

  const canSubmit =
    campaignName.trim().length > 0 &&
    jobTitle.trim().length > 0 &&
    jobDescription.trim().length > 0 &&
    requiredSkills.trim().length > 0 &&
    employmentType.trim().length > 0;

  return (
    <ModalShell
      title="Create Campaign"
      description="Add the role details now. You can refine scoring and outreach after launch."
      onClose={onClose}
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onCreate(
            { campaignName, jobTitle, jobDescription, requiredSkills, employmentType },
            () => {
              setCampaignName("");
              setJobTitle("");
              setJobDescription("");
              setRequiredSkills("");
              setEmploymentType("Full-time");
            },
          );
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Campaign name" hint="Required">
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className={inputClass()}
              placeholder="e.g., Q2 Growth Hiring"
              autoFocus
            />
          </Field>
          <Field label="Job title" hint="Required">
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className={inputClass()}
              placeholder="e.g., Senior Front-End Engineer"
            />
          </Field>
        </div>

        <Field label="Job description" hint="Required">
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className={textareaClass()}
            placeholder="Describe responsibilities, expectations, and what success looks like."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Required skills" hint="Required • comma-separated">
            <input
              value={requiredSkills}
              onChange={(e) => setRequiredSkills(e.target.value)}
              className={inputClass()}
              placeholder="React, TypeScript, GraphQL"
            />
          </Field>
          <Field label="Employment type" hint="Required">
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
              className={selectClass()}
            >
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
            </select>
          </Field>
        </div>

        {error ? (
          <div className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
            <div className="font-semibold">Couldn’t create campaign</div>
            <div className="mt-1">{error}</div>
          </div>
        ) : null}

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || isCreating}
            className={[
              "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-white shadow-sm ring-1",
              canSubmit && !isCreating
                ? "bg-indigo-600 ring-indigo-500/20 hover:bg-indigo-500"
                : "bg-zinc-300 ring-zinc-200/70 text-white/80 cursor-not-allowed",
            ].join(" ")}
          >
            {isCreating ? "Creating…" : "Create campaign"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

