"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  DEFAULT_SCREENING_QUESTIONS,
  Field,
  dangerIconButtonClass,
  inputClass,
  normalizeStringArray,
  primaryButtonClass,
  softPrimaryButtonClass,
  textareaClass,
} from "@/components/calls/callSetupShared";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type CallSetupTemplateDraft = {
  templateName: string;
  companyName: string;
  selectedQuestions: string[];
  customQuestions: string[];
  callNotes: string;
};

export type CallSetupTemplateInitial = {
  id: string;
  templateName: string;
  companyName: string | null;
  selectedQuestions: string[];
  customQuestions: string[];
  callNotes: string | null;
};

export function CallSetupTemplateForm({
  mode,
  templateId,
  initial,
  returnTo,
}: {
  mode: "create" | "edit";
  templateId?: string;
  initial?: CallSetupTemplateInitial | null;
  returnTo?: string | null;
}) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();

  const initialSelected = useMemo(
    () => new Set(normalizeStringArray(initial?.selectedQuestions)),
    [initial],
  );

  const [templateName, setTemplateName] = useState(initial?.templateName ?? "");
  const [companyName, setCompanyName] = useState(String(initial?.companyName ?? ""));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));
  const [customQuestions, setCustomQuestions] = useState<string[]>(
    () => normalizeStringArray(initial?.customQuestions),
  );
  const [customQuestionDraft, setCustomQuestionDraft] = useState("");
  const [callNotes, setCallNotes] = useState(String(initial?.callNotes ?? ""));

  const [templateTouched, setTemplateTouched] = useState(false);
  const [templateValidation, setTemplateValidation] = useState<string | null>(null);

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

  function getSafeReturnTo(value: string | null | undefined) {
    const v = String(value ?? "").trim();
    if (!v) return "/calls";
    if (!v.startsWith("/")) return "/calls";
    if (v.startsWith("//")) return "/calls";
    return v;
  }

  async function onSave() {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);

    const safeTemplateName = templateName.trim();
    if (!safeTemplateName.length) {
      setTemplateTouched(true);
      setTemplateValidation("Template name is required.");
      setIsSaving(false);
      return;
    }

    const safeCompany = companyName.trim();
    if (!safeCompany.length) {
      setCompanyTouched(true);
      setCompanyValidation("Company / consultancy name is required.");
      setIsSaving(false);
      return;
    }

    const selectedQuestions = Array.from(selected).map((q) => q.trim()).filter(Boolean);
    const custom = customQuestions.map((q) => q.trim()).filter(Boolean);
    const safeNotes = callNotes.trim();

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error(userError?.message ?? "You must be signed in to save templates.");

      if (mode === "create") {
        const { error: createErr } = await supabase.from("call_setup_templates").insert({
          user_id: user.id,
          template_name: safeTemplateName,
          company_name: safeCompany,
          selected_questions: selectedQuestions,
          custom_questions: custom,
          call_notes: safeNotes.length ? safeNotes : null,
        });
        if (createErr) throw createErr;
      } else {
        if (!templateId) throw new Error("Missing template id.");
        const { error: updateErr } = await supabase
          .from("call_setup_templates")
          .update({
            template_name: safeTemplateName,
            company_name: safeCompany,
            selected_questions: selectedQuestions,
            custom_questions: custom,
            call_notes: safeNotes.length ? safeNotes : null,
          })
          .eq("id", templateId)
          .eq("user_id", user.id);
        if (updateErr) throw updateErr;
      }

      setSaved(true);
      setIsSaving(false);
      window.setTimeout(() => {
        router.push(getSafeReturnTo(returnTo));
        router.refresh();
      }, 550);
    } catch (e) {
      const errObj = e as unknown as {
        message?: unknown;
        details?: unknown;
        hint?: unknown;
        code?: unknown;
      };

      const parts = [
        typeof errObj.message === "string" && errObj.message.trim().length ? errObj.message.trim() : null,
        typeof errObj.details === "string" && errObj.details.trim().length ? errObj.details.trim() : null,
        typeof errObj.hint === "string" && errObj.hint.trim().length ? errObj.hint.trim() : null,
        typeof errObj.code === "string" && errObj.code.trim().length ? `Code: ${errObj.code.trim()}` : null,
      ].filter(Boolean);

      setError(parts.length ? parts.join(" • ") : "Couldn’t save template.");
      setIsSaving(false);
    }
  }

  const templateOk = templateName.trim().length > 0;
  const templateError =
    templateValidation ?? (templateTouched && !templateOk ? "Template name is required." : null);

  const companyOk = companyName.trim().length > 0;
  const companyError =
    companyValidation ??
    (companyTouched && !companyOk ? "Company / consultancy name is required." : null);

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
      <div className="text-sm font-semibold text-zinc-900">
        {mode === "create" ? "New call setup template" : "Edit call setup template"}
      </div>
      <div className="mt-1 text-sm text-zinc-600">
        Save a reusable set of screening questions and instructions, then apply it to campaigns.
      </div>

      {saved ? (
        <div className="mt-5 rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200/70">
          <div className="font-semibold">Saved</div>
          <div className="mt-1 text-emerald-800">Returning to templates…</div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
          <div className="font-semibold text-rose-900">Couldn’t save template</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5">
        <Field label="Template name" hint="Required">
          <div>
            <input
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value);
                setTemplateValidation(null);
              }}
              onBlur={() => setTemplateTouched(true)}
              className={[
                inputClass(),
                templateError ? "ring-rose-300 focus:ring-rose-500/15" : "",
              ].join(" ")}
              placeholder="e.g. “Consulting screen — Standard”"
              aria-invalid={templateError ? true : undefined}
              disabled={isSaving}
            />
            {templateError ? (
              <div className="mt-2 text-sm font-medium text-rose-700">{templateError}</div>
            ) : null}
          </div>
        </Field>

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
          <div>
            <div className="text-sm font-semibold text-zinc-900">Custom questions</div>
            <div className="mt-1 text-sm text-zinc-600">Add role-specific questions your team cares about.</div>
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
              if (!templateOk) {
                setTemplateTouched(true);
                setTemplateValidation("Template name is required.");
                return;
              }
              if (!companyOk) {
                setCompanyTouched(true);
                setCompanyValidation("Company / consultancy name is required.");
                return;
              }
              void onSave();
            }}
            disabled={isSaving}
            aria-disabled={!templateOk || !companyOk || isSaving}
            className={primaryButtonClass(isSaving || !templateOk || !companyOk)}
          >
            {isSaving ? "Saving…" : "Save template"}
          </button>
        </div>
      </div>
    </div>
  );
}

