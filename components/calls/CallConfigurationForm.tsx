"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const DEFAULT_SCREENING_QUESTIONS = [
  "Are you currently available for a new role?",
  "How many years of experience do you have?",
  "Are you comfortable with this employment type?",
  "What is your expected salary/rate?",
  "Are you open to relocation or remote/hybrid work?",
  "When can you start?",
  "Do you require visa sponsorship?",
] as const;

function inputClass() {
  return "h-11 w-full rounded-2xl bg-white px-4 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";
}

function textareaClass() {
  return "min-h-[140px] w-full resize-y rounded-2xl bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";
}

function Field({
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

function primaryButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold shadow-sm ring-1 transition",
    disabled
      ? "bg-indigo-400 text-white ring-indigo-500/10 cursor-not-allowed"
      : "bg-indigo-600 text-white ring-indigo-500/20 hover:bg-indigo-500",
  ].join(" ");
}

function softPrimaryButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold shadow-sm ring-1 transition",
    disabled
      ? "bg-zinc-100 text-zinc-400 ring-zinc-200 cursor-not-allowed"
      : "bg-indigo-50 text-indigo-900 ring-indigo-200/70 hover:bg-indigo-100",
  ].join(" ");
}

function dangerIconButtonClass(disabled?: boolean) {
  return [
    "grid size-9 shrink-0 place-items-center rounded-2xl ring-1 transition",
    disabled
      ? "bg-rose-50 text-rose-300 ring-rose-100 cursor-not-allowed"
      : "bg-rose-50 text-rose-700 ring-rose-200/70 hover:bg-rose-100",
  ].join(" ");
}

export type CallConfigurationDraft = {
  companyName: string | null;
  selectedQuestions: string[];
  customQuestions: string[];
  callNotes: string | null;
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

export function CallConfigurationForm({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: CallConfigurationDraft | null;
}) {
  const router = useRouter();

  const initialSelected = useMemo(() => new Set(normalizeStringArray(initial?.selectedQuestions)), [initial]);
  const [companyName, setCompanyName] = useState(initial?.companyName ?? "");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));
  const [customQuestions, setCustomQuestions] = useState<string[]>(() => normalizeStringArray(initial?.customQuestions));
  const [customQuestionDraft, setCustomQuestionDraft] = useState("");
  const [callNotes, setCallNotes] = useState(initial?.callNotes ?? "");

  const [companyTouched, setCompanyTouched] = useState(false);
  const [companyValidation, setCompanyValidation] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleDefaultQuestion(question: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(question);
      else next.delete(question);
      return next;
    });
  }

  function addCustomQuestionToList() {
    const value = customQuestionDraft.trim();
    if (!value) return;
    setCustomQuestions((prev) => [...prev, value]);
    setCustomQuestionDraft("");
  }

  function removeCustomQuestion(idx: number) {
    setCustomQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSave() {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);

    const safeCompany = companyName.trim();
    if (!safeCompany.length) {
      setCompanyTouched(true);
      setCompanyValidation("Company / consultancy name is required.");
      setIsSaving(false);
      return;
    }

    const safeNotes = callNotes.trim();
    const selectedQuestions = Array.from(selected).map((q) => q.trim()).filter(Boolean);
    const custom = customQuestions.map((q) => q.trim()).filter(Boolean);

    const { error } = await supabase
      .from("call_configurations")
      .upsert(
        {
          campaign_id: campaignId,
          company_name: safeCompany,
          selected_questions: selectedQuestions,
          custom_questions: custom,
          call_notes: safeNotes.length ? safeNotes : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "campaign_id" },
      );

    if (error) {
      setError(error.message);
      setIsSaving(false);
      return;
    }

    setSaved(true);
    setIsSaving(false);

    window.setTimeout(() => {
      router.push(`/campaigns/${encodeURIComponent(campaignId)}`);
      router.refresh();
    }, 650);
  }

  const companyOk = companyName.trim().length > 0;
  const companyError =
    companyValidation ?? (companyTouched && !companyOk ? "Company / consultancy name is required." : null);

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-900">Call configuration</div>
          <div className="mt-1 text-sm text-zinc-600">
            Choose what the AI recruiter should ask and any special instructions to follow.
          </div>
        </div>
      </div>

      {saved ? (
        <div className="mt-5 rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200/70">
          <div className="font-semibold">Saved</div>
          <div className="mt-1 text-emerald-800">Returning to the campaign…</div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
          <div className="font-semibold text-rose-900">Couldn’t save configuration</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5">
        <Field label="Company / consultancy name" hint="Required">
          <div>
            <input
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setCompanyValidation(null);
              }}
              onBlur={() => setCompanyTouched(true)}
              className={[
                inputClass(),
                companyError ? "ring-rose-300 focus:ring-rose-500/15" : "",
              ].join(" ")}
              placeholder="e.g. Acme Consulting"
              aria-invalid={companyError ? true : undefined}
              disabled={isSaving}
            />
            {companyError ? (
              <div className="mt-2 text-sm font-medium text-rose-700">{companyError}</div>
            ) : null}
          </div>
        </Field>

        <div className="grid gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-sm font-semibold text-zinc-900">Default screening questions</div>
            <div className="text-xs text-zinc-500">Select all that apply</div>
          </div>

          <div className="grid gap-2">
            {DEFAULT_SCREENING_QUESTIONS.map((q) => (
              <label
                key={q}
                className="flex items-start gap-3 rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-800 ring-1 ring-zinc-200/70"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500/20"
                  checked={selected.has(q)}
                  onChange={(e) => toggleDefaultQuestion(q, e.currentTarget.checked)}
                  disabled={isSaving}
                />
                <span className="leading-6">{q}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-900">Custom questions</div>
              <div className="mt-1 text-sm text-zinc-600">Add role-specific questions your team cares about.</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={customQuestionDraft}
              onChange={(e) => setCustomQuestionDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                addCustomQuestionToList();
              }}
              className={inputClass()}
              placeholder="Type a custom screening question…"
              disabled={isSaving}
            />
            <button
              type="button"
              onClick={addCustomQuestionToList}
              className={softPrimaryButtonClass(isSaving || customQuestionDraft.trim().length === 0)}
              disabled={isSaving || customQuestionDraft.trim().length === 0}
            >
              Add to list
            </button>
          </div>

          {customQuestions.length ? (
            <div className="grid gap-2">
              {customQuestions.map((q, idx) => (
                <div
                  key={`${q}-${idx}`}
                  className="flex items-start justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-zinc-800 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50/50"
                >
                  <div className="min-w-0 leading-6 text-zinc-900">{q}</div>
                  <button
                    type="button"
                    onClick={() => removeCustomQuestion(idx)}
                    disabled={isSaving}
                    className={dangerIconButtonClass(isSaving)}
                    aria-label="Remove custom question"
                    title="Remove"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none">
                      <path
                        d="M7 7l10 10M17 7 7 17"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-zinc-50 p-4 text-sm text-zinc-600 ring-1 ring-zinc-200/70">
              No custom questions yet.
            </div>
          )}
        </div>

        <Field label="Call notes / instructions" hint="Optional">
          <textarea
            value={callNotes}
            onChange={(e) => setCallNotes(e.target.value)}
            className={textareaClass()}
            placeholder="e.g. Keep the call under 8 minutes. Probe for leadership experience and availability."
            disabled={isSaving}
          />
        </Field>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (!companyOk) {
                setCompanyTouched(true);
                setCompanyValidation("Company / consultancy name is required.");
                return;
              }
              void onSave();
            }}
            disabled={isSaving}
            aria-disabled={!companyOk || isSaving}
            className={primaryButtonClass(isSaving || !companyOk)}
          >
            {isSaving ? "Saving…" : "Save configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}

