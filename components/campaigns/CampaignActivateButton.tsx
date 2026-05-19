"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useState } from "react";

function primaryButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold shadow-sm ring-1 transition",
    disabled
      ? "bg-indigo-400 text-white ring-indigo-500/10 cursor-not-allowed"
      : "bg-indigo-600 text-white ring-indigo-500/20 hover:bg-indigo-500",
  ].join(" ");
}

export function CampaignActivateButton({
  campaignId,
  disabled,
  disabledReason,
}: {
  campaignId: string;
  disabled: boolean;
  disabledReason?: string | null;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onActivate() {
    if (disabled || isSaving) return;
    setIsSaving(true);
    setError(null);

    const { error } = await supabase
      .from("campaigns")
      .update({ status: "Ready", updated_at: new Date().toISOString() })
      .eq("id", campaignId);

    if (error) {
      setError(error.message);
      setIsSaving(false);
      return;
    }

    router.push(`/campaigns/${encodeURIComponent(campaignId)}`);
    router.refresh();
  }

  return (
    <div>
      <button type="button" onClick={onActivate} disabled={disabled || isSaving} className={primaryButtonClass(disabled || isSaving)}>
        {isSaving ? "Activating…" : "Activate campaign"}
      </button>
      {disabled && disabledReason ? (
        <div className="mt-2 text-sm font-medium text-zinc-600">{disabledReason}</div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
          <div className="font-semibold text-rose-900">Couldn’t activate campaign</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}
    </div>
  );
}

