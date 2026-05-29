"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function buttonClass(disabled?: boolean) {
  return [
    "inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold ring-1 transition",
    disabled
      ? "bg-emerald-200 text-emerald-900/70 ring-emerald-200/70 cursor-not-allowed"
      : "bg-emerald-600 text-white ring-emerald-500/20 hover:bg-emerald-500",
  ].join(" ");
}

export function ContinueAnywayButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/call-queue`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ overrideCallingWindow: true }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error ?? "Couldn’t continue.")
            : `Couldn’t continue (HTTP ${res.status}).`;
        throw new Error(message);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t continue.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-1">
      <button type="button" className={buttonClass(isSaving)} disabled={isSaving} onClick={onClick}>
        {isSaving ? "Starting…" : "Continue Anyway"}
      </button>
      {error ? <div className="text-xs font-semibold text-rose-700">{error}</div> : null}
    </div>
  );
}

