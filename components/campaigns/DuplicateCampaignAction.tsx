"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function modalShellClass() {
  return "fixed inset-0 z-50 grid place-items-center bg-zinc-900/30 p-4 backdrop-blur-sm";
}

function cardClass() {
  return "flex w-full max-w-xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-zinc-200/70";
}

function inputClass() {
  return "h-11 w-full rounded-2xl bg-white px-4 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";
}

function primaryButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-white shadow-sm ring-1",
    disabled ? "bg-zinc-300 ring-zinc-200/70 cursor-not-allowed" : "bg-indigo-600 ring-indigo-500/20 hover:bg-indigo-500",
  ].join(" ");
}

function secondaryButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50",
    disabled ? "opacity-60 cursor-not-allowed" : "",
  ].join(" ");
}

function headerNeutralButtonClass() {
  return "inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";
}

function StepCheckbox({
  checked,
  disabled,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200/70">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.currentTarget.checked)}
        className="mt-1 size-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500/20"
      />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-zinc-900">{label}</div>
        <div className="mt-0.5 text-sm text-zinc-600">{description}</div>
      </div>
    </label>
  );
}

export function DuplicateCampaignAction({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [copy1, setCopy1] = useState(true);
  const [copy2, setCopy2] = useState(true);
  const [copy3, setCopy3] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepCount = Number(copy1) + Number(copy2) + Number(copy3);
  const canSubmit = name.trim().length > 0 && stepCount > 0 && !isSaving;

  const validationError = useMemo(() => {
    if (!name.trim()) return "New campaign name is required.";
    if (stepCount === 0) return "Select at least one step to copy.";
    return null;
  }, [name, stepCount]);

  async function onCreate() {
    if (!canSubmit) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/duplicate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          newCampaignName: name.trim(),
          copyStep1: copy1,
          copyStep2: copy2,
          copyStep3: copy3,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error ?? "Couldn’t duplicate campaign.")
            : `Couldn’t duplicate campaign (HTTP ${res.status}).`;
        throw new Error(message);
      }

      const newId =
        payload && typeof payload === "object" && "campaignId" in payload ? String((payload as { campaignId?: unknown }).campaignId ?? "") : "";
      if (!newId) throw new Error("Duplicate created but no campaign id returned.");

      setOpen(false);
      setName("");
      router.push(`/campaigns/${encodeURIComponent(newId)}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t duplicate campaign.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button type="button" className={headerNeutralButtonClass()} onClick={() => setOpen(true)}>
        Duplicate Campaign
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Duplicate Campaign"
          className={modalShellClass()}
          onMouseDown={(e) => {
            if (e.currentTarget === e.target && !isSaving) setOpen(false);
          }}
        >
          <div className={cardClass()}>
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200/70 px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900">Duplicate Campaign</div>
                <div className="mt-1 text-sm text-zinc-600">Create a new campaign by copying selected setup steps.</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSaving) setOpen(false);
                }}
                className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-zinc-700 ring-1 ring-zinc-200/70 hover:bg-zinc-50 hover:text-zinc-900"
                aria-label="Close"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none">
                  <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="grid gap-5">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">New Campaign Name</div>
                  <div className="mt-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass()}
                      placeholder="e.g., Q3 Hiring — Duplicate"
                      disabled={isSaving}
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-zinc-900">Copy setup steps</div>
                  <div className="mt-3 grid gap-2">
                    <StepCheckbox
                      checked={copy1}
                      disabled={isSaving}
                      onChange={setCopy1}
                      label="Step 1 — Campaign Details"
                      description="Job title, description, skills, employment type, and campaign fields."
                    />
                    <StepCheckbox
                      checked={copy2}
                      disabled={isSaving}
                      onChange={setCopy2}
                      label="Step 2 — Candidates"
                      description="Deep-copies attached candidate lists and candidate rows into new lists."
                    />
                    <StepCheckbox
                      checked={copy3}
                      disabled={isSaving}
                      onChange={setCopy3}
                      label="Step 3 — Call Configuration"
                      description="Company name, screening questions, and call notes/instructions."
                    />
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">Step 4 (activation) and Step 5 (outreach history) are never copied.</div>
                </div>

                {error || validationError ? (
                  <div className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
                    <div className="font-semibold text-rose-900">Couldn’t create duplicate</div>
                    <div className="mt-1">{error ?? validationError}</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-zinc-200/70 bg-white px-5 py-4 sm:px-6">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className={secondaryButtonClass(isSaving)}
                  disabled={isSaving}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={primaryButtonClass(!canSubmit)}
                  disabled={!canSubmit}
                  onClick={onCreate}
                >
                  {isSaving ? "Creating…" : "Create Duplicate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

