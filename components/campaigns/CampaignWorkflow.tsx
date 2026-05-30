"use client";

import { CampaignEditAction, type CampaignEditInitial } from "@/components/campaigns/CampaignDetailActions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

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
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [isQueueing, setIsQueueing] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const [creditWarning, setCreditWarning] = useState<{
    open: boolean;
    credits: number;
    candidates: number;
  }>({ open: false, credits: 0, candidates: 0 });
  const [creditOverride, setCreditOverride] = useState(false);
  const candidatesComplete = candidateCount > 0;
  const activated = status === "Ready" || status === "Calling" || status === "Paused" || status === "Completed";
  const canStartCalls = status === "Ready";
  const outreachActive = status === "Calling" || status === "Paused" || status === "Completed";
  const canViewOutreach = outreachActive || hasCallSession;
  const sessionLower = String(callSessionStatus ?? "").toLowerCase();
  const sessionPaused = sessionLower.startsWith("paused");
  const sessionStopped = sessionLower === "stopped";
  const sessionCompleted = sessionLower === "completed";

  const outreachLocked =
    status === "Calling" &&
    hasCallSession &&
    !sessionPaused &&
    !sessionStopped &&
    !sessionCompleted;

  function showLockedMessage() {
    setLockNotice("Outreach is currently running. Pause or stop outreach before editing campaign setup.");
    window.setTimeout(() => setLockNotice(null), 6500);
  }

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
  const reportsAvailable = sessionCompleted || status === "Completed";
  const step6State = reportsAvailable ? ("complete" as const) : ("pending" as const);

  async function startCallsNow() {
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

  async function onStartCalls() {
    if (!canStartCalls || isQueueing) return;

    if (!creditOverride && candidateCount > 0) {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
          setQueueError(userError?.message ?? "You must be signed in to start outreach.");
          return;
        }

        const { data: creditsRow, error: creditsError } = await supabase
          .from("user_credits")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();
        if (creditsError) {
          setQueueError(creditsError.message);
          return;
        }

        const balance = Number((creditsRow as { balance?: unknown } | null)?.balance ?? 0);
        if (candidateCount > balance) {
          setCreditWarning({ open: true, credits: balance, candidates: candidateCount });
          return;
        }
      } catch (e) {
        setQueueError(e instanceof Error ? e.message : "Couldn’t check credits.");
        return;
      }
    }

    await startCallsNow();
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
      {creditWarning.open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Low credit balance"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setCreditWarning((prev) => ({ ...prev, open: false }));
          }}
        >
          <div className="w-full max-w-[520px] rounded-3xl bg-white shadow-xl ring-1 ring-zinc-200/70">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200/70 px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900">Low Credit Balance</div>
                <div className="mt-1 text-sm text-zinc-600">
                  You currently have <span className="font-semibold text-zinc-900">{creditWarning.credits}</span> credits.
                  <br />
                  This campaign contains <span className="font-semibold text-zinc-900">{creditWarning.candidates}</span> candidates.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreditWarning((prev) => ({ ...prev, open: false }))}
                className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-zinc-700 ring-1 ring-zinc-200/70 hover:bg-zinc-50 hover:text-zinc-900"
                aria-label="Close"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none">
                  <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-5 text-sm text-zinc-700 sm:px-6">
              <div>
                You may run out of credits before all candidates are contacted.
              </div>
              <div className="mt-2">
                Add credits now to avoid interruption.
              </div>
            </div>

            <div className="border-t border-zinc-200/70 bg-white px-5 py-4 sm:px-6">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCreditWarning((prev) => ({ ...prev, open: false }));
                    router.push("/finances#buy-credits");
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
                >
                  Add Credits
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setCreditOverride(true);
                    setCreditWarning((prev) => ({ ...prev, open: false }));
                    await startCallsNow();
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-500/20 hover:bg-emerald-500"
                >
                  Continue Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Workflow</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Recommended steps to launch and run this campaign.
          </p>
        </div>
      </div>

      {lockNotice ? (
        <div className="mt-4 rounded-3xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200/70">
          <div className="font-semibold">Editing locked</div>
          <div className="mt-1 text-amber-800">{lockNotice}</div>
        </div>
      ) : null}

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
                    className={workflowActionButtonClass(outreachLocked)}
                    label="Edit campaign"
                    disabled={outreachLocked}
                    onDisabledClick={showLockedMessage}
                  />
                </div>
                <StatusIndicator state={s.state} />
              </div>
            ) : null}

            {idx === 1 ? (
              <div className="mt-auto pt-4">
                <div className="text-xs text-zinc-600">Attach reusable candidate lists to this campaign.</div>
                <div className="mt-3">
                  {outreachLocked ? (
                    <button
                      type="button"
                      aria-disabled="true"
                      className={workflowActionButtonClass(true)}
                      onClick={showLockedMessage}
                    >
                      Add candidates
                    </button>
                  ) : (
                    <Link
                      href={`/candidates?campaignId=${encodeURIComponent(campaignId)}`}
                      className={workflowActionButtonClass(false)}
                    >
                      Add candidates
                    </Link>
                  )}
                </div>
                <StatusIndicator state={s.state} />
              </div>
            ) : null}

            {idx === 2 ? (
              <div className="mt-auto pt-4">
                <div className="text-xs text-zinc-600">Set up screening questions and instructions.</div>
                <div className="mt-3">
                  {candidatesComplete ? (
                    outreachLocked ? (
                      <button
                        type="button"
                        aria-disabled="true"
                        className={workflowActionButtonClass(true)}
                        onClick={showLockedMessage}
                      >
                        {callsConfigured ? "Edit call configuration" : "Configure calls"}
                      </button>
                    ) : (
                      <Link
                        href={`/calls?campaignId=${encodeURIComponent(campaignId)}`}
                        className={workflowActionButtonClass(false)}
                      >
                        {callsConfigured ? "Edit call configuration" : "Configure calls"}
                      </Link>
                    )
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
                    outreachLocked ? (
                      <button
                        type="button"
                        aria-disabled="true"
                        className={workflowActionButtonClass(true)}
                        onClick={showLockedMessage}
                      >
                        {activated ? "View review" : "Review & activate"}
                      </button>
                    ) : (
                      <Link
                        href={`/campaigns/${encodeURIComponent(campaignId)}/review`}
                        className={workflowActionButtonClass(false)}
                      >
                        {activated ? "View review" : "Review & activate"}
                      </Link>
                    )
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

        <div
          className={[
            "flex h-full flex-col rounded-3xl p-4 ring-1 shadow-sm transition hover:shadow-md",
            stepCardClass(step6State),
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 6</div>
            <span
              className={[
                "grid size-7 place-items-center rounded-2xl text-xs font-semibold ring-1",
                stepBadgeClass(step6State),
              ].join(" ")}
            >
              {step6State === "complete" ? "✓" : 6}
            </span>
          </div>

          <div className="mt-3 text-sm font-semibold text-zinc-900">Reports</div>
          <div className="mt-4 text-xs text-zinc-600">
            Review completed call results, summaries, and candidate outcomes.
          </div>

          <div className="mt-auto pt-4">
            {reportsAvailable ? (
              <Link href={`/reports?campaignId=${encodeURIComponent(campaignId)}`} className={workflowActionButtonClass(false)}>
                View report
              </Link>
            ) : (
              <button type="button" disabled className={workflowActionButtonClass(true)}>
                Available after outreach completes
              </button>
            )}
            <div className="mt-2 text-xs text-zinc-600">Available after Step 5 completes</div>
            <StatusIndicator state={step6State} />
          </div>
        </div>
      </div>
    </div>
  );
}

