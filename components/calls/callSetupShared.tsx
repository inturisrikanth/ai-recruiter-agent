import type React from "react";

export const DEFAULT_SCREENING_QUESTIONS = [
  "Are you currently available for a new role?",
  "How many years of experience do you have?",
  "Are you comfortable with this employment type?",
  "What is your expected salary/rate?",
  "Are you open to relocation or remote/hybrid work?",
  "When can you start?",
  "Do you require visa sponsorship?",
] as const;

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

export function inputClass() {
  return "h-11 w-full rounded-2xl bg-white px-4 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";
}

export function textareaClass() {
  return "min-h-[140px] w-full resize-y rounded-2xl bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-zinc-900">{label}</span>
        {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
      </div>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export function primaryButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold shadow-sm ring-1 transition",
    disabled
      ? "bg-indigo-400 text-white ring-indigo-500/10 cursor-not-allowed"
      : "bg-indigo-600 text-white ring-indigo-500/20 hover:bg-indigo-500",
  ].join(" ");
}

export function secondaryButtonClass() {
  return "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50";
}

export function softPrimaryButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold shadow-sm ring-1 transition",
    disabled
      ? "bg-zinc-100 text-zinc-400 ring-zinc-200 cursor-not-allowed"
      : "bg-indigo-50 text-indigo-900 ring-indigo-200/70 hover:bg-indigo-100",
  ].join(" ");
}

export function dangerIconButtonClass(disabled?: boolean) {
  return [
    "grid size-9 shrink-0 place-items-center rounded-2xl ring-1 transition",
    disabled
      ? "bg-rose-50 text-rose-300 ring-rose-100 cursor-not-allowed"
      : "bg-rose-50 text-rose-700 ring-rose-200/70 hover:bg-rose-100",
  ].join(" ");
}

