"use client";

import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type CampaignStatus = "Draft" | "Active" | "Paused";

function nextStatus(status: CampaignStatus): CampaignStatus {
  if (status === "Draft") return "Active";
  if (status === "Active") return "Paused";
  return "Active";
}

function actionLabel(status: CampaignStatus) {
  if (status === "Draft") return "Activate campaign";
  if (status === "Active") return "Pause campaign";
  return "Resume campaign";
}

function actionButtonClass(status: CampaignStatus) {
  if (status === "Active") {
    return "bg-amber-600 text-white ring-amber-500/20 hover:bg-amber-500";
  }
  if (status === "Paused") {
    return "bg-teal-600 text-white ring-teal-500/20 hover:bg-teal-500";
  }
  return "bg-emerald-600 text-white ring-emerald-500/20 hover:bg-emerald-500";
}

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

export function CampaignWorkflow({
  campaignId,
  status,
  candidateCount,
}: {
  campaignId: string;
  status: CampaignStatus;
  candidateCount: number;
}) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = useMemo(() => nextStatus(status), [status]);
  const candidatesComplete = candidateCount > 0;
  const activatedAtLeastOnce = status !== "Draft";

  const canActivate = status !== "Draft" || candidateCount > 0;

  const currentStep = useMemo(() => {
    if (!candidatesComplete) return 2;
    if (status === "Draft") return 3;
    return 3;
  }, [candidatesComplete, status]);

  const steps = [
    { title: "Campaign details", state: "complete" as const },
    {
      title: "Add candidates",
      state:
        candidatesComplete ? ("complete" as const) : currentStep === 2 ? ("current" as const) : ("pending" as const),
    },
    {
      title: "Activate campaign",
      state:
        activatedAtLeastOnce
          ? ("complete" as const)
          : currentStep === 3
            ? ("current" as const)
            : ("pending" as const),
    },
    {
      title: "Start calls",
      state: "pending" as const,
    },
  ];

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
                  {candidatesComplete
                    ? `${candidateCount.toLocaleString()} candidates attached`
                    : "No candidates yet"}
                </div>
              </div>
            ) : null}

            {idx === 2 ? (
              <div className="mt-4">
                <button
                  type="button"
                  disabled={isUpdating || !canActivate}
                  onClick={async () => {
                    if (!canActivate) return;
                    setIsUpdating(true);
                    setError(null);
                    const { error } = await supabase
                      .from("campaigns")
                      .update({ status: target, updated_at: new Date().toISOString() })
                      .eq("id", campaignId);
                    if (error) {
                      setError(error.message);
                      setIsUpdating(false);
                      return;
                    }
                    setIsUpdating(false);
                    router.refresh();
                  }}
                  className={[
                    "inline-flex h-10 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold shadow-sm ring-1 transition",
                    isUpdating || !canActivate
                      ? "bg-zinc-200 text-zinc-700 ring-zinc-200/70 cursor-not-allowed"
                      : actionButtonClass(status),
                  ].join(" ")}
                >
                  {isUpdating ? "Updating…" : actionLabel(status)}
                </button>
                <div className="mt-2 text-xs text-zinc-600">
                  {status === "Draft" && candidateCount === 0
                    ? "Add candidates first"
                    : status === "Draft"
                      ? "Activates outreach and tracking"
                      : status === "Active"
                        ? "Temporarily stops outreach"
                        : "Continues outreach"}
                </div>
              </div>
            ) : null}

            {idx === 3 ? (
              <div className="mt-4">
                <button
                  type="button"
                  disabled
                  className="inline-flex h-10 w-full items-center justify-center rounded-2xl bg-zinc-200 px-4 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200/70 cursor-not-allowed"
                >
                  Start calls
                </button>
                <div className="mt-2 text-xs text-zinc-600">
                  Available after activation
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-4 rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
          <div className="font-semibold">Couldn’t update campaign</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}
    </div>
  );
}

