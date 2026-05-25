"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function buttonClass(disabled?: boolean) {
  return [
    "inline-flex h-9 items-center justify-center rounded-full px-3 text-sm font-semibold ring-1 transition",
    disabled
      ? "bg-zinc-100 text-zinc-400 ring-zinc-200/70 cursor-not-allowed"
      : "bg-indigo-50 text-indigo-900 ring-indigo-200/70 hover:bg-indigo-100",
  ].join(" ");
}

export function RetryNowButton({
  campaignId,
  candidateCallId,
  disabled,
}: {
  campaignId: string;
  candidateCallId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (disabled || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/outreach/retry-now`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateCallId }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error ?? "Couldn’t start retry.")
            : `Couldn’t start retry (HTTP ${res.status}).`;
        throw new Error(message);
      }

      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t start retry.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-1">
      <button type="button" className={buttonClass(disabled || isSaving)} disabled={disabled || isSaving} onClick={onClick}>
        {isSaving ? "Retrying…" : "Retry now"}
      </button>
      {error ? <div className="text-xs font-semibold text-rose-700">{error}</div> : null}
    </div>
  );
}

