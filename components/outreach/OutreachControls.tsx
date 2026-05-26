"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function primaryButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold shadow-sm ring-1 transition",
    disabled
      ? "bg-zinc-200 text-zinc-700 ring-zinc-200/70 cursor-not-allowed"
      : "bg-white text-zinc-900 ring-zinc-200/70 hover:bg-zinc-50",
  ].join(" ");
}

function softPauseButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold shadow-sm ring-1 transition",
    disabled
      ? "bg-amber-100 text-amber-400 ring-amber-200/70 cursor-not-allowed"
      : "bg-amber-50 text-amber-900 ring-amber-200/70 hover:bg-amber-100",
  ].join(" ");
}

function softResumeButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold shadow-sm ring-1 transition",
    disabled
      ? "bg-emerald-100 text-emerald-400 ring-emerald-200/70 cursor-not-allowed"
      : "bg-emerald-50 text-emerald-900 ring-emerald-200/70 hover:bg-emerald-100",
  ].join(" ");
}

function dangerButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold shadow-sm ring-1 transition",
    disabled
      ? "bg-rose-100 text-rose-400 ring-rose-200/70 cursor-not-allowed"
      : "bg-rose-50 text-rose-700 ring-rose-200/70 hover:bg-rose-100",
  ].join(" ");
}

function ModalShell({
  title,
  description,
  children,
  footer,
  onClose,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
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
      <div className="flex w-full max-w-xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-zinc-200/70">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200/70 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900">{title}</div>
            {description ? <div className="mt-1 text-sm text-zinc-600">{description}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-zinc-700 ring-1 ring-zinc-200/70 hover:bg-zinc-50 hover:text-zinc-900"
            aria-label="Close"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none">
              <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? <div className="border-t border-zinc-200/70 bg-white px-5 py-4 sm:px-6">{footer}</div> : null}
      </div>
    </div>
  );
}

export function OutreachControls({
  campaignId,
  hasSession,
  sessionStatus,
  compact = false,
}: {
  campaignId: string;
  hasSession: boolean;
  sessionStatus: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);

  const statusLower = (sessionStatus ?? "").toLowerCase();
  const isPaused = statusLower === "paused";
  const isStopped = statusLower === "stopped";
  const isCompleted = statusLower === "completed";

  const canPauseOrResume = hasSession && !isStopped && !isCompleted;
  const canStop = hasSession && !isStopped && !isCompleted;

  const pauseLabel = useMemo(() => {
    if (!hasSession) return "Pause outreach";
    return isPaused ? "Resume outreach" : "Pause outreach";
  }, [hasSession, isPaused]);

  async function sendAction(action: "pause" | "resume" | "stop") {
    if (!hasSession) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/outreach`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action }),
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
            ? String((payload as { error?: unknown }).error ?? "Couldn’t update outreach.")
            : `Couldn’t update outreach (HTTP ${res.status}).`;
        throw new Error(message);
      }

      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t update outreach.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {!isStopped ? (
          <>
            <button
              type="button"
              className={(isPaused ? softResumeButtonClass : softPauseButtonClass)(!canPauseOrResume || isSaving)}
              disabled={!canPauseOrResume || isSaving}
              onClick={() => sendAction(isPaused ? "resume" : "pause")}
            >
              {isSaving ? "Saving…" : pauseLabel}
            </button>
            <button
              type="button"
              className={dangerButtonClass(!canStop || isSaving)}
              disabled={!canStop || isSaving}
              onClick={() => setConfirmStopOpen(true)}
            >
              Stop outreach
            </button>
          </>
        ) : (
          <span className="inline-flex h-10 items-center rounded-2xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200/80">
            Outreach stopped
          </span>
        )}
      </div>

      {hasSession && isCompleted ? (
        <div className="mt-2 text-xs text-zinc-600">Outreach completed. No pending calls remain.</div>
      ) : null}
      {!compact && !hasSession ? (
        <div className="mt-2 text-xs text-zinc-600">Create a queue first (Step 5 “Start calls”).</div>
      ) : null}
      {!compact && hasSession && isStopped ? (
        <div className="mt-2 text-xs text-zinc-600">Outreach is stopped. Activate the campaign again to restart.</div>
      ) : null}
      {error ? <div className="mt-3 text-xs font-semibold text-rose-700">{error}</div> : null}

      {confirmStopOpen ? (
        <ModalShell
          title="Stop outreach?"
          description="This will stop the current outreach session. The queue will be kept (no rows deleted)."
          onClose={() => {
            if (isSaving) return;
            setConfirmStopOpen(false);
          }}
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className={primaryButtonClass(isSaving)}
                disabled={isSaving}
                onClick={() => setConfirmStopOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={dangerButtonClass(isSaving)}
                disabled={isSaving}
                onClick={async () => {
                  await sendAction("stop");
                  setConfirmStopOpen(false);
                }}
              >
                {isSaving ? "Stopping…" : "Stop outreach"}
              </button>
            </div>
          }
        >
          <div className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
            <div className="font-semibold text-rose-900">Heads up</div>
            <div className="mt-1">
              Once stopped, this session status will be marked <span className="font-semibold">stopped</span>. You can
              create a new queue later by re-activating the campaign and starting calls again.
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

