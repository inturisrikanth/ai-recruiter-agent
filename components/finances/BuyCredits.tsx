 "use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function parseWholeCredits(input: string) {
  const raw = input.trim();
  if (!raw) return { ok: false as const, reason: "empty" as const };
  if (!/^\d+$/.test(raw)) return { ok: false as const, reason: "not_integer" as const };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return { ok: false as const, reason: "too_small" as const };
  return { ok: true as const, value: Math.floor(n) };
}

export function BuyCredits() {
  const router = useRouter();
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const customParsed = useMemo(() => parseWholeCredits(custom), [custom]);
  const estimatedCost = customParsed.ok ? customParsed.value : null;

  async function purchase(credits: number) {
    setError(null);

    const res = await fetch("/api/billing/purchase-credits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credits }),
    });

    if (!res.ok) {
      let message = "Purchase failed. Please try again.";
      try {
        const data = (await res.json()) as { error?: unknown };
        const m = String(data?.error ?? "").trim();
        if (m) message = m;
      } catch {
        // ignore
      }
      setError(message);
      return;
    }

    setCustom("");
    router.refresh();
  }

  function onPreset(credits: number) {
    startTransition(() => purchase(credits));
  }

  function onCustom() {
    if (!customParsed.ok) {
      if (customParsed.reason === "empty") setError("Enter the number of credits you want to buy.");
      else if (customParsed.reason === "not_integer") setError("Credits must be a whole number (no decimals).");
      else setError("Minimum purchase is 1 credit.");
      return;
    }
    startTransition(() => purchase(customParsed.value));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[100, 500, 1000].map((credits) => (
          <button
            key={credits}
            type="button"
            onClick={() => onPreset(credits)}
            disabled={isPending}
            className={[
              "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold shadow-sm ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30",
              isPending
                ? "cursor-not-allowed bg-zinc-100 text-zinc-500 ring-zinc-200/70"
                : "bg-white text-zinc-900 ring-zinc-200/70 hover:bg-zinc-50 hover:ring-indigo-200/70",
            ].join(" ")}
          >
            Buy {credits.toLocaleString()} Credits
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:max-w-md">
        <label className="text-sm font-semibold text-zinc-900">Custom amount</label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={custom}
            onChange={(e) => {
              setError(null);
              setCustom(e.target.value);
            }}
            inputMode="numeric"
            placeholder="e.g. 25"
            className="h-11 w-full rounded-2xl bg-white px-4 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <button
            type="button"
            onClick={onCustom}
            disabled={isPending}
            className={[
              "inline-flex h-11 shrink-0 items-center justify-center rounded-full px-5 text-sm font-semibold shadow-sm ring-1",
              isPending
                ? "cursor-not-allowed bg-zinc-100 text-zinc-500 ring-zinc-200/70"
                : "bg-indigo-600 text-white ring-indigo-500/20 hover:bg-indigo-500",
            ].join(" ")}
          >
            Add Credits
          </button>
        </div>

        <div className="text-sm text-zinc-600">
          {estimatedCost == null ? (
            <span>Estimated cost: —</span>
          ) : (
            <span>
              Estimated cost: <span className="font-semibold text-zinc-900">${estimatedCost.toLocaleString()}</span>
            </span>
          )}
        </div>

        {error ? (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200/70">
            {error}
          </div>
        ) : null}

        <div className="text-xs text-zinc-500">$1 = 1 credit.</div>
      </div>
    </div>
  );
}

