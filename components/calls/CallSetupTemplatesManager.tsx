"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type CallSetupTemplateRow = {
  id: string;
  templateName: string;
  companyName: string;
  selectedQuestions: string[];
  customQuestions: string[];
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

function primaryButtonClass() {
  return "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-500/20 hover:bg-indigo-500";
}

function tableActionButtonClass() {
  return "inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-200/70 hover:bg-zinc-50";
}

function dangerButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold ring-1",
    disabled
      ? "bg-rose-100 text-rose-400 ring-rose-200/70 cursor-not-allowed"
      : "bg-rose-50 text-rose-700 ring-rose-200/70 hover:bg-rose-100",
  ].join(" ");
}

export function CallSetupTemplatesManager({
  initialTemplates,
}: {
  initialTemplates: CallSetupTemplateRow[];
}) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const renderedTemplates = useMemo(() => initialTemplates, [initialTemplates]);

  async function onDeleteTemplate(templateId: string, label: string) {
    const ok = window.confirm(`Delete “${label}”? This will remove the reusable template only.`);
    if (!ok) return;
    setIsDeleting(templateId);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setIsDeleting(null);
      window.alert(userError?.message ?? "You must be signed in to delete templates.");
      return;
    }

    const { error } = await supabase.from("call_setup_templates").delete().eq("id", templateId).eq("user_id", user.id);
    setIsDeleting(null);
    if (error) {
      window.alert(error.message);
      return;
    }
    router.refresh();
  }

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
            <Link href="/calls/templates/new" className={primaryButtonClass()}>
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

      <section className="mt-6">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3 text-right">Questions</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70">
                {renderedTemplates.length ? (
                  renderedTemplates.map((t) => {
                    const selectedCount = t.selectedQuestions.length;
                    const customCount = t.customQuestions.length;
                    const totalCount = selectedCount + customCount;

                    return (
                      <tr key={t.id} className="hover:bg-zinc-50/60">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-900">{t.templateName}</div>
                          <div className="mt-1 text-xs text-zinc-500">Reusable setup template</div>
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
                        <td className="px-4 py-3 text-right text-zinc-700">
                          <span className="font-semibold text-zinc-900">{formatNumber(totalCount)}</span>{" "}
                          <span className="text-xs text-zinc-500">
                            ({formatNumber(selectedCount)} default, {formatNumber(customCount)} custom)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{formatDateTime(t.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Link href={`/calls/templates/${encodeURIComponent(t.id)}`} className={tableActionButtonClass()}>
                              Open/Edit
                            </Link>
                            <button
                              type="button"
                              onClick={() => onDeleteTemplate(t.id, t.templateName)}
                              className={dangerButtonClass(isDeleting === t.id)}
                              disabled={isDeleting === t.id}
                            >
                              {isDeleting === t.id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10">
                      <div className="mx-auto max-w-xl text-center">
                        <div className="text-sm font-semibold text-zinc-900">No call setup templates yet</div>
                        <p className="mt-1 text-sm text-zinc-600">
                          Create a reusable setup once, then apply it to any campaign in Step 3.
                        </p>
                        <div className="mt-4">
                          <Link href="/calls/templates/new" className={primaryButtonClass()}>
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
    </div>
  );
}

