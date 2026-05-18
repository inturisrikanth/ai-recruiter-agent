"use client";

import { supabase } from "@/lib/supabaseClient";
import Papa from "papaparse";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type CandidateList = {
  id: string;
  listName: string;
  sourceFileName: string;
  totalCandidates: number;
  createdAt: string; // ISO
};

type ParsedCandidateRow = {
  name: string;
  phone: string;
  email: string;
};

type CsvWarnings = {
  duplicateCount: number;
  missingPhoneCount: number;
  missingEmailCount: number;
};

const stableNumberFormatter = new Intl.NumberFormat("en-US");

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

function formatNumber(value: number) {
  return stableNumberFormatter.format(value);
}

function ModalShell({
  title,
  description,
  children,
  footer,
  onClose,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center bg-zinc-900/30 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="flex w-full max-w-3xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-zinc-200/70">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200/70 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900">{title}</div>
            {description ? <div className="mt-1 text-sm text-zinc-600">{description}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-zinc-700 ring-1 ring-zinc-200/70 hover:bg-zinc-50 hover:text-zinc-900"
            aria-label="Close"
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
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="border-t border-zinc-200/70 bg-white px-5 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
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

function inputClass() {
  return "h-11 w-full rounded-2xl bg-white px-4 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";
}

function secondaryButtonClass() {
  return "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50";
}

function primaryButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold shadow-sm ring-1",
    disabled
      ? "bg-indigo-400 text-white ring-indigo-500/10"
      : "bg-indigo-600 text-white ring-indigo-500/20 hover:bg-indigo-500",
  ].join(" ");
}

function campaignActionButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold shadow-sm ring-1 transition-colors",
    disabled
      ? "bg-rose-100 text-rose-400 ring-rose-200/70 cursor-not-allowed"
      : "bg-rose-50 text-rose-800 ring-rose-200/70 hover:bg-rose-100",
  ].join(" ");
}

function tableActionButtonClass() {
  return "inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-200/70 hover:bg-zinc-50";
}

function dangerButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold ring-1",
    disabled
      ? "bg-rose-100 text-rose-400 ring-rose-200/70"
      : "bg-rose-50 text-rose-700 ring-rose-200/70 hover:bg-rose-100",
  ].join(" ");
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function CandidateListsManager({
  initialLists,
  campaignId,
  initialAttachedListIds,
  initialAttachedLoadError,
}: {
  initialLists: CandidateList[];
  campaignId?: string | null;
  initialAttachedListIds?: string[];
  initialAttachedLoadError?: string | null;
}) {
  const router = useRouter();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [listName, setListName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCandidateRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [csvWarnings, setCsvWarnings] = useState<CsvWarnings>({
    duplicateCount: 0,
    missingPhoneCount: 0,
    missingEmailCount: 0,
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isSelectionSaving, setIsSelectionSaving] = useState(false);

  const initialAttached = useMemo(
    () => new Set((initialAttachedListIds ?? []).map(String)),
    [initialAttachedListIds],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialAttached));

  const previewRows = useMemo(() => parsedRows.slice(0, 5), [parsedRows]);
  const selectionCount = selected.size;
  const selectionTotalCandidates = useMemo(() => {
    if (!campaignId) return 0;
    let total = 0;
    for (const l of initialLists) {
      if (selected.has(l.id)) total += l.totalCandidates;
    }
    return total;
  }, [campaignId, initialLists, selected]);

  function resetModal() {
    setListName("");
    setFile(null);
    setParsedRows([]);
    setParseError(null);
    setCsvWarnings({ duplicateCount: 0, missingPhoneCount: 0, missingEmailCount: 0 });
    setSaveError(null);
    setIsSaving(false);
  }

  function closeModal() {
    setIsUploadOpen(false);
    resetModal();
  }

  async function parseCsv(selected: File) {
    setParseError(null);
    setParsedRows([]);
    setCsvWarnings({ duplicateCount: 0, missingPhoneCount: 0, missingEmailCount: 0 });
    setSaveError(null);

    if (!selected.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please upload a .csv file.");
      return;
    }

    const text = await selected.text();
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    if (result.errors?.length) {
      setParseError(result.errors[0]?.message ?? "Couldn’t parse CSV.");
      return;
    }

    const fields = (result.meta.fields ?? []).map((f) => f.trim().toLowerCase());
    const required = ["name", "phone", "email"];
    const missing = required.filter((r) => !fields.includes(r));
    if (missing.length) {
      setParseError(`Missing required columns: ${missing.join(", ")}.`);
      return;
    }

    const rows = (result.data ?? [])
      .map((row) => ({
        name: String(row.name ?? "").trim(),
        phone: String(row.phone ?? "").trim(),
        email: String(row.email ?? "").trim(),
      }))
      .filter((r) => r.name || r.phone || r.email);

    if (!rows.length) {
      setParseError("No rows found. Ensure your CSV has data and the required columns.");
      return;
    }

    const normalizePhone = (value: string) => value.trim().replace(/[\s\-()]/g, "");
    const normalizeEmail = (value: string) => value.trim().toLowerCase();

    let duplicateCount = 0;
    let missingPhoneCount = 0;
    let missingEmailCount = 0;
    const seen = new Set<string>();

    for (const r of rows) {
      const phone = normalizePhone(r.phone);
      const email = normalizeEmail(r.email);

      if (!phone) missingPhoneCount += 1;
      if (!email) missingEmailCount += 1;

      const key = phone ? `p:${phone}` : email ? `e:${email}` : null;
      if (!key) continue;
      if (seen.has(key)) duplicateCount += 1;
      else seen.add(key);
    }

    setParsedRows(rows);
    setCsvWarnings({ duplicateCount, missingPhoneCount, missingEmailCount });
  }

  async function onSave() {
    setSaveError(null);

    const safeListName = listName.trim();
    if (!safeListName) {
      setSaveError("List name is required.");
      return;
    }
    if (!file) {
      setSaveError("CSV file is required.");
      return;
    }
    if (parseError) {
      setSaveError("Fix the CSV issues before saving.");
      return;
    }
    if (!parsedRows.length) {
      setSaveError("No candidates parsed. Upload a valid CSV first.");
      return;
    }

    setIsSaving(true);
    let createdListId: string | null = null;
    try {
      const { data: created, error: createErr } = await supabase
        .from("candidate_lists")
        .insert({
          list_name: safeListName,
          source_file_name: file.name,
          total_candidates: 0,
        })
        .select("id")
        .single();

      if (createErr) throw createErr;
      createdListId = String(created.id);

      const candidateRows = parsedRows.map((r) => ({
        list_id: createdListId,
        name: r.name,
        phone: r.phone,
        email: r.email,
      }));

      for (const batch of chunk(candidateRows, 500)) {
        const { error: insertErr } = await supabase.from("candidates").insert(batch);
        if (insertErr) throw insertErr;
      }

      const { error: updateErr } = await supabase
        .from("candidate_lists")
        .update({ total_candidates: parsedRows.length })
        .eq("id", createdListId);
      if (updateErr) throw updateErr;

      closeModal();
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong while saving.";
      setSaveError(message);
      if (createdListId) {
        await supabase.from("candidate_lists").delete().eq("id", createdListId);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function onDeleteList(listId: string, label: string) {
    const ok = window.confirm(`Delete “${label}”? This will remove the list and all candidates in it.`);
    if (!ok) return;
    const { error } = await supabase.from("candidate_lists").delete().eq("id", listId);
    if (error) {
      window.alert(error.message);
      return;
    }
    router.refresh();
  }

  async function onSaveSelection() {
    if (!campaignId) return;
    setSelectionError(null);
    setIsSelectionSaving(true);
    try {
      const selectedIds = Array.from(selected);

      const toRemove = Array.from(initialAttached).filter((id) => !selected.has(id));
      const toAdd = selectedIds.filter((id) => !initialAttached.has(id));

      if (selectedIds.length === 0) {
        const { error: deleteAllErr } = await supabase
          .from("campaign_candidate_lists")
          .delete()
          .eq("campaign_id", campaignId);
        if (deleteAllErr) throw deleteAllErr;

        const { error: updateErr } = await supabase
          .from("campaigns")
          .update({ candidate_count: 0, updated_at: new Date().toISOString() })
          .eq("id", campaignId);
        if (updateErr) throw updateErr;

        router.push(`/campaigns/${encodeURIComponent(campaignId)}`);
        router.refresh();
        return;
      }

      if (toRemove.length) {
        const { error: removeErr } = await supabase
          .from("campaign_candidate_lists")
          .delete()
          .eq("campaign_id", campaignId)
          .in("list_id", toRemove);
        if (removeErr) throw removeErr;
      }

      if (toAdd.length) {
        const rows = toAdd.map((listId) => ({ campaign_id: campaignId, list_id: listId }));
        const { error: addErr } = await supabase
          .from("campaign_candidate_lists")
          .upsert(rows, { onConflict: "campaign_id,list_id", ignoreDuplicates: true });
        if (addErr) throw addErr;
      }

      const { data: lists, error: listsErr } = await supabase
        .from("candidate_lists")
        .select("id,total_candidates")
        .in("id", selectedIds);
      if (listsErr) throw listsErr;

      const totalCandidates = (lists ?? []).reduce(
        (sum, row) => sum + Number(row.total_candidates ?? 0),
        0,
      );

      const { error: updateErr } = await supabase
        .from("campaigns")
        .update({ candidate_count: totalCandidates, updated_at: new Date().toISOString() })
        .eq("id", campaignId);
      if (updateErr) throw updateErr;

      router.push(`/campaigns/${encodeURIComponent(campaignId)}`);
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn’t save candidate selection.";
      setSelectionError(message);
    } finally {
      setIsSelectionSaving(false);
    }
  }

  return (
    <div>
      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-medium text-zinc-500">Candidates</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              Candidate lists
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Upload reusable CSV lists and reuse them across campaigns.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className={campaignId ? secondaryButtonClass() : primaryButtonClass(false)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              Upload candidate list
            </button>
          </div>
        </div>
      </header>

      {campaignId ? (
        <div className="mt-6 rounded-3xl bg-indigo-50 p-5 ring-1 ring-indigo-200/70 sm:p-6">
          <div className="text-sm font-semibold text-indigo-900">
            Select a candidate list to attach to this campaign.
          </div>
          <div className="mt-1 text-sm text-indigo-800">
            Choose an existing list below to attach it.
          </div>
        </div>
      ) : null}

      {campaignId && initialAttachedLoadError ? (
        <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
          <div className="text-sm font-semibold text-rose-900">Couldn’t load current selection</div>
          <div className="mt-1 text-sm text-rose-800">{initialAttachedLoadError}</div>
        </div>
      ) : null}

      {campaignId ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-zinc-600">
            <span className="font-semibold text-zinc-900">{selectionCount}</span>{" "}
            {selectionCount === 1 ? "list" : "lists"} selected{" "}
            <span aria-hidden="true">•</span>{" "}
            <span className="font-semibold text-zinc-900">
              {formatNumber(selectionTotalCandidates)}
            </span>{" "}
            candidates
          </div>
          <Link
            href={`/campaigns/${encodeURIComponent(campaignId)}`}
            className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            Back to campaign
          </Link>
        </div>
      ) : null}

      {campaignId && selectionError ? (
        <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
          <div className="text-sm font-semibold text-rose-900">Couldn’t save selection</div>
          <div className="mt-1 text-sm text-rose-800">{selectionError}</div>
        </div>
      ) : null}

      <section className="mt-6">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  {campaignId ? <th className="w-12 px-4 py-3" aria-label="Selected" /> : null}
                  <th className="px-4 py-3">List</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Candidates</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">
                    {campaignId ? "Select" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70">
                {initialLists.length ? (
                  initialLists.map((l) => (
                    <tr key={l.id} className="hover:bg-zinc-50/60">
                      {campaignId ? (
                        <td className="px-4 py-3 align-middle">
                          <input
                            type="checkbox"
                            checked={selected.has(l.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectionError(null);
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(l.id);
                                else next.delete(l.id);
                                return next;
                              });
                            }}
                            className="size-4 rounded border-zinc-300 text-rose-600 focus:ring-rose-500/20"
                          />
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-900">{l.listName}</div>
                        <div className="mt-1 text-xs text-zinc-500">Reusable candidate list</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {l.sourceFileName ? (
                          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200/80">
                            {l.sourceFileName}
                          </span>
                        ) : (
                          <span className="text-sm text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-900">
                        {formatNumber(l.totalCandidates)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{formatDateTime(l.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {campaignId ? (
                            <span
                              className={[
                                "inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold ring-1",
                                selected.has(l.id)
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70"
                                  : "bg-zinc-100 text-zinc-700 ring-zinc-200/80",
                              ].join(" ")}
                            >
                              {selected.has(l.id) ? "Selected" : "Not selected"}
                            </span>
                          ) : (
                            <>
                              <Link href={`/candidates/${l.id}`} className={tableActionButtonClass()}>
                                Open
                              </Link>
                              <button
                                type="button"
                                onClick={() => onDeleteList(l.id, l.listName)}
                                className={dangerButtonClass(false)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={campaignId ? 6 : 5} className="px-4 py-10">
                      <div className="mx-auto max-w-xl text-center">
                        <div className="text-sm font-semibold text-zinc-900">
                          No candidate lists yet
                        </div>
                        <p className="mt-1 text-sm text-zinc-600">
                          Upload a CSV to create your first reusable list.
                        </p>
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => setIsUploadOpen(true)}
                            className={primaryButtonClass(false)}
                          >
                            Upload candidate list
                          </button>
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

      {campaignId ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onSaveSelection}
            disabled={isSelectionSaving}
            className={campaignActionButtonClass(isSelectionSaving)}
          >
            {isSelectionSaving ? "Saving…" : "Attach to campaign"}
          </button>
        </div>
      ) : null}

      {isUploadOpen ? (
        <ModalShell
          title="Upload candidate list"
          description="CSV only for now. Required columns: name, phone, email."
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeModal} className={secondaryButtonClass()}>
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                className={primaryButtonClass(isSaving)}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Save list"}
              </button>
            </div>
          }
          onClose={closeModal}
        >
          <div className="grid gap-5">
            <Field label="List name" hint="Shown in your dashboard">
              <input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                className={inputClass()}
                placeholder="e.g. “Engineering leads — May 2026”"
              />
            </Field>

            <Field label="CSV file" hint="Accepts .csv">
              <input
                type="file"
                accept=".csv,text/csv"
                className={[
                  "block w-full rounded-2xl bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70",
                  "file:mr-4 file:rounded-full file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800",
                ].join(" ")}
                onChange={async (e) => {
                  const f = e.currentTarget.files?.[0] ?? null;
                  setFile(f);
                  setParsedRows([]);
                  setParseError(null);
                  setCsvWarnings({ duplicateCount: 0, missingPhoneCount: 0, missingEmailCount: 0 });
                  setSaveError(null);
                  if (f) await parseCsv(f);
                }}
              />
              <div className="mt-2 text-xs text-zinc-500">
                Columns must be exactly <span className="font-semibold text-zinc-700">name</span>,{" "}
                <span className="font-semibold text-zinc-700">phone</span>,{" "}
                <span className="font-semibold text-zinc-700">email</span>.
              </div>
            </Field>

            {parseError ? (
              <div className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
                <div className="font-semibold text-rose-900">CSV issue</div>
                <div className="mt-1">{parseError}</div>
              </div>
            ) : null}

            {parsedRows.length &&
            (csvWarnings.duplicateCount ||
              csvWarnings.missingPhoneCount ||
              csvWarnings.missingEmailCount) ? (
              <div className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200/70">
                <div className="font-semibold">Warnings</div>
                <div className="mt-2 space-y-1 text-sm text-amber-900">
                  {csvWarnings.duplicateCount ? (
                    <div>
                      Warning: {formatNumber(csvWarnings.duplicateCount)} duplicate phone/email{" "}
                      {csvWarnings.duplicateCount === 1 ? "entry" : "entries"} found in this file.
                      These candidates may receive duplicate calls.
                    </div>
                  ) : null}
                  {csvWarnings.missingPhoneCount ? (
                    <div>
                      Warning: {formatNumber(csvWarnings.missingPhoneCount)}{" "}
                      {csvWarnings.missingPhoneCount === 1 ? "row is" : "rows are"} missing phone
                      numbers. These candidates cannot be called unless phone numbers are added.
                    </div>
                  ) : null}
                  {csvWarnings.missingEmailCount ? (
                    <div>
                      Warning: {formatNumber(csvWarnings.missingEmailCount)}{" "}
                      {csvWarnings.missingEmailCount === 1 ? "row is" : "rows are"} missing email
                      addresses. Email follow-up will not be available for those candidates.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {parsedRows.length ? (
              <div className="rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">Preview</div>
                    <div className="mt-1 text-sm text-zinc-600">
                      Parsed {formatNumber(parsedRows.length)} candidates.
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-3xl bg-white ring-1 ring-zinc-200/70">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Phone</th>
                          <th className="px-4 py-3">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200/70">
                        {previewRows.map((r, idx) => (
                          <tr key={`${r.email}-${idx}`} className="hover:bg-zinc-50/60">
                            <td className="px-4 py-3 font-medium text-zinc-900">{r.name || "—"}</td>
                            <td className="px-4 py-3 text-zinc-700">{r.phone || "—"}</td>
                            <td className="px-4 py-3 text-zinc-700">{r.email || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-2 text-xs font-medium text-zinc-600">
                  {parsedRows.length > previewRows.length
                    ? `Showing first ${previewRows.length} of ${formatNumber(parsedRows.length)} candidates`
                    : `Showing ${formatNumber(parsedRows.length)} candidate${parsedRows.length === 1 ? "" : "s"}`}
                </div>
              </div>
            ) : null}

            {saveError ? (
              <div className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
                <div className="font-semibold text-rose-900">Couldn’t save list</div>
                <div className="mt-1">{saveError}</div>
              </div>
            ) : null}

          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

