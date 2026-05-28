"use client";

import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type CallSetupTemplateRow = {
  id: string;
  templateName: string;
  companyName: string;
  selectedQuestions: string[];
  customQuestions: string[];
  callNotes: string | null;
  createdAt: string; // ISO
};

const stableNumberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number) {
  return stableNumberFormatter.format(value);
}

function formatDateTime(iso: string) {
  // Manual UTC formatting to avoid Node/browser Intl differences during hydration.
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getUTCMonth()] ?? "—";
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");

  let hour = d.getUTCHours();
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${month} ${day}, ${year}, ${hour}:${minutes} ${ampm}`;
}

function primaryButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold shadow-sm ring-1 transition-colors",
    disabled
      ? "bg-indigo-200 text-indigo-400 ring-indigo-200/70 cursor-not-allowed"
      : "bg-indigo-600 text-white ring-indigo-500/20 hover:bg-indigo-500",
  ].join(" ");
}

function tableStatusBadgeClass(selected: boolean) {
  return [
    "inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold ring-1",
    selected ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70" : "bg-zinc-100 text-zinc-700 ring-zinc-200/80",
  ].join(" ");
}

export function CampaignCallSetupTemplatesSelector({
  campaignId,
  templates,
  initialAttachedTemplateId,
}: {
  campaignId: string;
  templates: CallSetupTemplateRow[];
  initialAttachedTemplateId?: string | null;
}) {
  const router = useRouter();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    const value = String(initialAttachedTemplateId ?? "").trim();
    return value.length ? value : "";
  });
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [attachedTemplateName, setAttachedTemplateName] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  async function onAttachSelected() {
    if (isAttaching) return;
    setSelectionError(null);
    setAttachedTemplateName(null);

    if (!selectedTemplate) {
      setSelectionError("Select a template to attach.");
      return;
    }

    const safeCompany = String(selectedTemplate.companyName ?? "").trim();
    if (!safeCompany.length) {
      setSelectionError("This template is missing a company / consultancy name.");
      return;
    }

    const selectedQuestions = (selectedTemplate.selectedQuestions ?? [])
      .map((q) => String(q ?? "").trim())
      .filter(Boolean);
    const customQuestions = (selectedTemplate.customQuestions ?? [])
      .map((q) => String(q ?? "").trim())
      .filter(Boolean);
    const safeNotes = String(selectedTemplate.callNotes ?? "").trim();

    setIsAttaching(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("call_configurations")
        .upsert(
          {
            campaign_id: campaignId,
            company_name: safeCompany,
            selected_questions: selectedQuestions,
            custom_questions: customQuestions,
            call_notes: safeNotes.length ? safeNotes : null,
            updated_at: now,
          },
          { onConflict: "campaign_id" },
        );

      if (error) throw error;

      const linkRow = {
        campaign_id: campaignId,
        call_setup_template_id: selectedTemplate.id,
        updated_at: now,
      };

      const { error: linkErr } = await supabase
        .from("campaign_call_setup_templates")
        .upsert(linkRow, { onConflict: "campaign_id" });

      if (linkErr) {
        // If the unique constraint isn't present yet, fall back to delete+insert.
        await supabase.from("campaign_call_setup_templates").delete().eq("campaign_id", campaignId);
        const { error: insertErr } = await supabase.from("campaign_call_setup_templates").insert(linkRow);
        if (insertErr) throw insertErr;
      }

      setAttachedTemplateName(selectedTemplate.templateName);
      window.setTimeout(() => {
        router.push(`/campaigns/${encodeURIComponent(campaignId)}`);
        router.refresh();
      }, 650);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn’t attach template.";
      setSelectionError(message);
    } finally {
      setIsAttaching(false);
    }
  }

  const selectionCount = selectedTemplateId ? 1 : 0;

  return (
    <div>
      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-medium text-zinc-500">Call setup</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              Call setup templates
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Save reusable call setups and apply them to campaigns.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/calls/templates/new?returnTo=${encodeURIComponent(`/calls?campaignId=${campaignId}`)}`}
              className={primaryButtonClass(false)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              New call template
            </Link>
          </div>
        </div>
      </header>

      <div className="mt-6 rounded-3xl bg-indigo-50 p-5 ring-1 ring-indigo-200/70 sm:p-6">
        <div className="text-sm font-semibold text-indigo-900">
          Select a call setup template to attach to this campaign.
        </div>
        <div className="mt-1 text-sm text-indigo-800">Choose an existing template below or create a new one.</div>
      </div>

      {selectionError ? (
        <div className="mt-6 rounded-3xl bg-rose-50 p-5 text-sm text-rose-800 ring-1 ring-rose-200/70 sm:p-6">
          <div className="text-sm font-semibold text-rose-900">Couldn’t attach template</div>
          <div className="mt-1">{selectionError}</div>
        </div>
      ) : null}

      {attachedTemplateName ? (
        <div className="mt-6 rounded-3xl bg-emerald-50 p-5 text-sm text-emerald-900 ring-1 ring-emerald-200/70 sm:p-6">
          <div className="font-semibold">Template attached</div>
          <div className="mt-1 text-emerald-800">
            Attached <span className="font-semibold">{attachedTemplateName}</span>. Returning to the campaign…
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-zinc-600">
          <span className="font-semibold text-zinc-900">{selectionCount}</span>{" "}
          {selectionCount === 1 ? "template" : "templates"} selected
        </div>
      </div>

      <section className="mt-6">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="w-12 px-4 py-3" aria-label="Selected" />
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3 text-right">Questions</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Select</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70">
                {templates.length ? (
                  templates.map((t) => {
                    const selectedCount = t.selectedQuestions.length;
                    const customCount = t.customQuestions.length;
                    const totalCount = selectedCount + customCount;
                    const isSelected = selectedTemplateId === t.id;

                    return (
                      <tr key={t.id} className="hover:bg-zinc-50/60">
                        <td className="px-4 py-3 align-middle">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectionError(null);
                              setSelectedTemplateId(checked ? t.id : "");
                            }}
                            className="size-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500/20"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-900">{t.templateName}</div>
                          <div className="mt-1 text-xs text-zinc-500">Reusable call setup template</div>
                        </td>
                        <td className="px-4 py-3 text-zinc-700">
                          {t.companyName ? (
                            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200/80">
                              {t.companyName}
                            </span>
                          ) : (
                            <span className="text-sm text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-zinc-900">
                          {formatNumber(totalCount)}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{formatDateTime(t.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <span className={tableStatusBadgeClass(isSelected)}>
                              {isSelected ? "Selected" : "Not selected"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10">
                      <div className="mx-auto max-w-xl text-center">
                        <div className="text-sm font-semibold text-zinc-900">No templates yet</div>
                        <p className="mt-1 text-sm text-zinc-600">
                          Create a reusable template first, then attach it to this campaign.
                        </p>
                        <div className="mt-4">
                          <Link
                            href={`/calls/templates/new?returnTo=${encodeURIComponent(`/calls?campaignId=${campaignId}`)}`}
                            className={primaryButtonClass(false)}
                          >
                            New call template
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onAttachSelected}
          disabled={isAttaching || templates.length === 0}
          className={primaryButtonClass(isAttaching || templates.length === 0)}
        >
          {isAttaching ? "Attaching…" : "Attach selected template"}
        </button>
      </div>
    </div>
  );
}

