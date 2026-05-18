"use client";

import Link from "next/link";
import { useMemo } from "react";

type CampaignStatus = "Draft" | "Active" | "Paused";

function stepCardClass(state: "complete" | "current" | "pending") {
  if (state === "complete") return "bg-emerald-50 ring-emerald-200/70";
  if (state === "current") return "bg-indigo-50 ring-indigo-200/70";
  return "bg-zinc-50 ring-zinc-200/70";
}

function stepBadgeClass(state: "complete" | "current" | "pending") {
  if (state === "complete") return "bg-white text-emerald-700 ring-emerald-200/70";
  if (state === "current") return "bg-white text-indigo-700 ring-indigo-200/70";
  return "bg-white text-zinc-700 ring-zinc-200/80";
}

export function CampaignWorkflow(props: {
  campaignId: string;
  status: CampaignStatus;
  candidateCount: number;
  attachedListNames?: string[];
}) {
  const { campaignId, candidateCount, attachedListNames } = props;
  const candidatesComplete = candidateCount > 0;

  const currentStep = useMemo(() => {
    if (!candidatesComplete) return 2;
    return 3;
  }, [candidatesComplete]);

  const steps = [
    { title: "Campaign details", state: "complete" as const },
    {
      title: "Add candidates",
      state:
        candidatesComplete ? ("complete" as const) : currentStep === 2 ? ("current" as const) : ("pending" as const),
    },
    {
      title: "Configure calls",
      state: candidatesComplete ? ("current" as const) : ("pending" as const),
    },
    {
      title: "Review & activate",
      state: "pending" as const,
    },
  ];

  const attachedNamesText = useMemo(() => {
    const names = (attachedListNames ?? []).map((n) => n.trim()).filter(Boolean);
    if (!names.length) return null;
    const max = 3;
    const shown = names.slice(0, max);
    const rest = names.length - shown.length;
    return rest > 0 ? `${shown.join(", ")} +${rest} more` : shown.join(", ");
  }, [attachedListNames]);

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Workflow</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Recommended steps to launch and run this campaign.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, idx) => (
          <div
            key={s.title}
            className={[
              "rounded-3xl p-4 ring-1 shadow-sm transition hover:shadow-md",
              stepCardClass(s.state),
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Step {idx + 1}
              </div>
              <span
                className={[
                  "grid size-7 place-items-center rounded-2xl text-xs font-semibold ring-1",
                  stepBadgeClass(s.state),
                ].join(" ")}
              >
                {s.state === "complete" ? "✓" : idx + 1}
              </span>
            </div>

            <div className="mt-3 text-sm font-semibold text-zinc-900">{s.title}</div>
            <div className="mt-1 text-sm text-zinc-600">
              {s.state === "complete" ? "Complete" : s.state === "current" ? "Next" : "Pending"}
            </div>

            {idx === 1 ? (
              <div className="mt-4">
                <Link
                  href={`/candidates?campaignId=${encodeURIComponent(campaignId)}`}
                  className="inline-flex h-10 w-full items-center justify-center rounded-2xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-500/20 transition hover:bg-indigo-500 hover:shadow-md"
                >
                  Add candidates
                </Link>
                <div className="mt-2 text-xs text-zinc-600">
                  {candidatesComplete ? (
                    attachedNamesText ? (
                      <>
                        <span className="font-semibold text-zinc-900">{attachedNamesText}</span>{" "}
                        <span aria-hidden="true">•</span>{" "}
                        {candidateCount.toLocaleString()} candidates attached
                      </>
                    ) : (
                      `${candidateCount.toLocaleString()} candidates attached`
                    )
                  ) : (
                    "No candidates yet"
                  )}
                </div>
              </div>
            ) : null}

            {idx === 2 ? (
              <div className="mt-4">
                <div className="mt-2 text-xs text-zinc-600">
                  Set up AI call behavior, screening questions, and outreach settings.
                </div>
                <div className="mt-3">
                  {candidatesComplete ? (
                    <Link
                      href={`/calls?campaignId=${encodeURIComponent(campaignId)}`}
                      className="inline-flex h-10 w-full items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
                    >
                      Configure calls
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex h-10 w-full items-center justify-center rounded-2xl bg-zinc-200 px-4 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200/70 cursor-not-allowed"
                    >
                      Add candidates first
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {idx === 3 ? (
              <div className="mt-4">
                <div className="text-xs text-zinc-600">
                  Review campaign setup and activate the campaign when ready.
                </div>
                <button
                  type="button"
                  disabled
                  className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-2xl bg-zinc-200 px-4 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200/70 cursor-not-allowed"
                >
                  Review & activate
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className={[
            "rounded-3xl p-4 ring-1 shadow-sm transition hover:shadow-md",
            stepCardClass("pending"),
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 5</div>
            <span
              className={[
                "grid size-7 place-items-center rounded-2xl text-xs font-semibold ring-1",
                stepBadgeClass("pending"),
              ].join(" ")}
            >
              5
            </span>
          </div>

          <div className="mt-3 text-sm font-semibold text-zinc-900">Start calls</div>
          <div className="mt-1 text-sm text-zinc-600">Pending</div>
          <div className="mt-4 text-xs text-zinc-600">
            Begin AI outreach and start processing candidate calls.
          </div>
          <div className="mt-3">
            <button
              type="button"
              disabled
              className="inline-flex h-10 w-full items-center justify-center rounded-2xl bg-zinc-200 px-4 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200/70 cursor-not-allowed"
            >
              Start calls
            </button>
            <div className="mt-2 text-xs text-zinc-600">Available after activation</div>
          </div>
        </div>
      </div>
    </div>
  );
}

