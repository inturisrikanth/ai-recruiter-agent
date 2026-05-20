"use client";

import { CampaignEditAction, type CampaignEditInitial } from "@/components/campaigns/CampaignDetailActions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type CampaignStatus = "Draft" | "Ready" | "Calling" | "Paused" | "Completed";

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

function workflowActionButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-10 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold shadow-sm ring-1 transition",
    disabled
      ? "bg-zinc-200 text-zinc-700 ring-zinc-200/70 cursor-not-allowed"
      : "bg-white text-zinc-900 ring-zinc-200/70 hover:bg-zinc-50",
  ].join(" ");
}

function StatusIndicator({ state }: { state: "complete" | "current" | "pending" }) {
  const label = state === "complete" ? "Complete" : state === "current" ? "Next" : "Pending";
  const styles =
    state === "complete"
      ? { ring: "ring-emerald-200/70", bg: "bg-emerald-50", text: "text-emerald-800", icon: "text-emerald-700" }
      : state === "current"
        ? { ring: "ring-indigo-200/70", bg: "bg-indigo-50", text: "text-indigo-800", icon: "text-indigo-700" }
        : { ring: "ring-zinc-200/70", bg: "bg-zinc-100", text: "text-zinc-700", icon: "text-zinc-500" };

  return (
    <div
      className={[
        "mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1",
        styles.bg,
        styles.ring,
        styles.text,
      ].join(" ")}
    >
      {state === "complete" ? (
        <span className={styles.icon} aria-hidden="true">
          ✓
        </span>
      ) : (
        <span className={["inline-block size-2 rounded-full", styles.icon, styles.bg].join(" ")} aria-hidden="true" />
      )}
      <span>{label}</span>
    </div>
  );
}

export function CampaignWorkflow(props: {
  campaignId: string;
  status: CampaignStatus;
  candidateCount: number;
  callsConfigured: boolean;
  editInitial: CampaignEditInitial;
  attachedListNames?: string[];
  hasCallSession?: boolean;
  callSessionStatus?: string | null;
}) {
  const { campaignId, candidateCount, callsConfigured, editInitial, status, hasCallSession = false, callSessionStatus } = props;
  const router = useRouter();
  const [isQueueing, setIsQueueing] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const candidatesComplete = candidateCount > 0;
  const activated = status === "Ready" || status === "Calling" || status === "Paused" || status === "Completed";
  const canStartCalls = status === "Ready";
  const outreachActive = status === "Calling" || status === "Paused" || status === "Completed";
  const canViewOutreach = outreachActive || hasCallSession;
  const sessionLower = String(callSessionStatus ?? "").toLowerCase();
  const sessionPaused = sessionLower === "paused";
  const sessionStopped = sessionLower === "stopped";

  const currentStep = useMemo(() => {
    if (!candidatesComplete) return 2;
    if (!callsConfigured) return 3;
    if (!activated) return 4;
    return 5;
  }, [candidatesComplete, callsConfigured, activated]);

  const steps = [
    { title: "Campaign details", state: "complete" as const },
    {
      title: "Add candidates",
      state:
        candidatesComplete ? ("complete" as const) : currentStep === 2 ? ("current" as const) : ("pending" as const),
    },
    {
      title: "Configure calls",
      state: !candidatesComplete ? ("pending" as const) : callsConfigured ? ("complete" as const) : ("current" as const),
    },
    {
      title: "Review & activate",
      state: !candidatesComplete || !callsConfigured ? ("pending" as const) : activated ? ("complete" as const) : ("current" as const),
    },
  ];

  const step5State = canStartCalls ? ("current" as const) : outreachActive ? ("complete" as const) : ("pending" as const);

  async function onStartCalls() {
    if (!canStartCalls || isQueueing) return;
    setIsQueueing(true);
    setQueueError(null);

    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/call-queue`, {
        method: "POST",
        cache: "no-store",
      });

      let payload: unknown = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (!res.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error ?? "Couldn’t start calls.")
            : `Couldn’t start calls (HTTP ${res.status}).`;
        throw new Error(message);
      }

      router.push(`/outreach?campaignId=${encodeURIComponent(campaignId)}`);
      router.refresh();
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : "Couldn’t start calls.");
    } finally {
      setIsQueueing(false);
    }
  }

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
              "flex h-full flex-col rounded-3xl p-4 ring-1 shadow-sm transition hover:shadow-md",
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

            {idx === 0 ? (
              <div className="mt-auto pt-4">
                <div className="text-xs text-zinc-600">Review the role brief and requirements.</div>
                <div className="mt-3">
                  <CampaignEditAction
                    campaignId={campaignId}
                    initial={editInitial}
                    className={workflowActionButtonClass(false)}
                    label="Edit campaign"
                  />
                </div>
                <StatusIndicator state={s.state} />
              </div>
            ) : null}

            {idx === 1 ? (
              <div className="mt-auto pt-4">
                <div className="text-xs text-zinc-600">Attach reusable candidate lists to this campaign.</div>
                <div className="mt-3">
                  <Link
                    href={`/candidates?campaignId=${encodeURIComponent(campaignId)}`}
                    className={workflowActionButtonClass(false)}
                  >
                    Add candidates
                  </Link>
                </div>
                <StatusIndicator state={s.state} />
              </div>
            ) : null}

            {idx === 2 ? (
              <div className="mt-auto pt-4">
                <div className="text-xs text-zinc-600">Set up screening questions and instructions.</div>
                <div className="mt-3">
                  {candidatesComplete ? (
                    <Link
                      href={`/calls?campaignId=${encodeURIComponent(campaignId)}`}
                      className={workflowActionButtonClass(false)}
                    >
                      {callsConfigured ? "Edit call configuration" : "Configure calls"}
                    </Link>
                  ) : (
                    <button type="button" disabled className={workflowActionButtonClass(true)}>
                      Add candidates first
                    </button>
                  )}
                </div>
                <StatusIndicator state={s.state} />
              </div>
            ) : null}

            {idx === 3 ? (
              <div className="mt-auto pt-4">
                <div className="text-xs text-zinc-600">Review setup and activate when ready.</div>
                <div className="mt-3">
                  {!candidatesComplete || !callsConfigured ? (
                    <button type="button" disabled className={workflowActionButtonClass(true)}>
                      Configure calls first
                    </button>
                  ) : (
                    <Link
                      href={`/campaigns/${encodeURIComponent(campaignId)}/review`}
                      className={workflowActionButtonClass(false)}
                    >
                      {activated ? "View review" : "Review & activate"}
                    </Link>
                  )}
                </div>
                <StatusIndicator state={s.state} />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className={[
            "flex h-full flex-col rounded-3xl p-4 ring-1 shadow-sm transition hover:shadow-md",
            stepCardClass(step5State),
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 5</div>
            <span
              className={[
                "grid size-7 place-items-center rounded-2xl text-xs font-semibold ring-1",
                stepBadgeClass(step5State),
              ].join(" ")}
            >
              5
            </span>
          </div>

          <div className="mt-3 text-sm font-semibold text-zinc-900">Start calls</div>
          <div className="mt-4 text-xs text-zinc-600">
            Begin AI outreach and start processing candidate calls.
          </div>
          <div className="mt-auto pt-4">
            {canStartCalls ? (
              <button
                type="button"
                onClick={onStartCalls}
                disabled={isQueueing}
                className={workflowActionButtonClass(isQueueing)}
              >
                {isQueueing ? "Starting…" : "Start calls"}
              </button>
            ) : canViewOutreach ? (
              <button
                type="button"
                onClick={() => {
                  router.push(`/outreach?campaignId=${encodeURIComponent(campaignId)}`);
                }}
                className={workflowActionButtonClass(false)}
              >
                View outreach
              </button>
            ) : (
              <button type="button" disabled className={workflowActionButtonClass(true)}>
                Activate campaign first
              </button>
            )}
            <div className="mt-2 text-xs text-zinc-600">Available when campaign is Ready</div>
            {sessionPaused ? <div className="mt-1 text-xs font-medium text-amber-800">Outreach is paused</div> : null}
            {sessionStopped ? (
              <div className="mt-1 text-xs font-medium text-zinc-700">
                Outreach was stopped. Activate again to restart.
              </div>
            ) : null}
            {queueError ? <div className="mt-3 text-xs font-semibold text-rose-700">{queueError}</div> : null}
            <StatusIndicator state={step5State} />
          </div>
        </div>
      </div>
    </div>
  );
}

