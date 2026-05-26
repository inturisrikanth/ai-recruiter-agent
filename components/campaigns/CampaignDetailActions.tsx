"use client";

import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useState } from "react";

type EmploymentType = "Full-time" | "Part-time" | "Contract" | "Internship";

export type CampaignEditInitial = {
  campaignName: string;
  jobTitle: string;
  jobDescription: string;
  requiredSkills: string;
  employmentType: EmploymentType;
};

function ModalShell({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
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
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-xl ring-1 ring-zinc-200/70">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200/70 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900">{title}</div>
            {description ? (
              <div className="mt-1 text-sm text-zinc-600">{description}</div>
            ) : null}
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
        <div className="px-5 py-5 sm:px-6">{children}</div>
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

function textareaClass() {
  return "min-h-[140px] w-full resize-y rounded-2xl bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";
}

function selectClass() {
  return "h-11 w-full rounded-2xl bg-white px-4 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";
}

export function CampaignDetailActions({
  campaignId,
  campaignName,
  jobTitle,
  jobDescription,
  requiredSkills,
  employmentType,
}: {
  campaignId: string;
  campaignName: string;
  jobTitle: string;
  jobDescription: string;
  requiredSkills: string;
  employmentType: EmploymentType;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <CampaignEditAction
        campaignId={campaignId}
        initial={{ campaignName, jobTitle, jobDescription, requiredSkills, employmentType }}
      />
      <CampaignDeleteAction campaignId={campaignId} campaignName={campaignName} />
    </div>
  );
}

function defaultHeaderNeutralButtonClass() {
  return "inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";
}

function defaultHeaderDangerButtonClass() {
  return "inline-flex h-11 items-center justify-center rounded-full bg-rose-50 px-5 text-sm font-semibold text-rose-700 shadow-sm ring-1 ring-rose-200/70 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500/15";
}

export function CampaignEditAction(props: {
  campaignId: string;
  initial: CampaignEditInitial;
  label?: string;
  className?: string;
  disabled?: boolean;
  onDisabledClick?: () => void;
}) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const label = props.label ?? "Edit campaign";
  const className = props.className ?? defaultHeaderNeutralButtonClass();
  const disabled = Boolean(props.disabled);

  return (
    <>
      <button
        type="button"
        aria-disabled={disabled ? true : undefined}
        onClick={() => {
          if (disabled) {
            props.onDisabledClick?.();
            return;
          }
          setIsEditOpen(true);
        }}
        className={[
          className,
          disabled ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {label}
      </button>

      {isEditOpen ? (
        <EditCampaignModal
          campaignId={props.campaignId}
          initial={props.initial}
          onClose={() => setIsEditOpen(false)}
          onSaved={() => {
            setIsEditOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

export function CampaignDeleteAction(props: {
  campaignId: string;
  campaignName: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const label = props.label ?? "Delete campaign";
  const className = props.className ?? defaultHeaderDangerButtonClass();

  return (
    <>
      <button type="button" onClick={() => setIsDeleteOpen(true)} className={className}>
        {label}
      </button>

      {isDeleteOpen ? (
        <DeleteCampaignModal
          campaignId={props.campaignId}
          campaignName={props.campaignName}
          onClose={() => setIsDeleteOpen(false)}
          onDeleted={() => {
            setIsDeleteOpen(false);
            router.push("/campaigns");
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function EditCampaignModal({
  campaignId,
  initial,
  onClose,
  onSaved,
}: {
  campaignId: string;
  initial: {
    campaignName: string;
    jobTitle: string;
    jobDescription: string;
    requiredSkills: string;
    employmentType: EmploymentType;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [campaignName, setCampaignName] = useState(initial.campaignName);
  const [jobTitle, setJobTitle] = useState(initial.jobTitle);
  const [jobDescription, setJobDescription] = useState(initial.jobDescription);
  const [requiredSkills, setRequiredSkills] = useState(initial.requiredSkills);
  const [employmentType, setEmploymentType] = useState<EmploymentType>(initial.employmentType);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    campaignName.trim().length > 0 &&
    jobTitle.trim().length > 0 &&
    jobDescription.trim().length > 0 &&
    requiredSkills.trim().length > 0 &&
    employmentType.trim().length > 0;

  return (
    <ModalShell
      title="Edit campaign"
      description="Update campaign details. Changes take effect immediately."
      onClose={() => {
        if (!isSaving) onClose();
      }}
    >
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!canSave || isSaving) return;
          setIsSaving(true);
          setError(null);

          const { error } = await supabase
            .from("campaigns")
            .update({
              campaign_name: campaignName.trim(),
              job_title: jobTitle.trim(),
              job_description: jobDescription.trim(),
              required_skills: requiredSkills.trim(),
              employment_type: employmentType,
              updated_at: new Date().toISOString(),
            })
            .eq("id", campaignId);

          if (error) {
            setError(error.message);
            setIsSaving(false);
            return;
          }

          setIsSaving(false);
          onSaved();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Campaign name" hint="Required">
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className={inputClass()}
              placeholder="e.g., Q2 Growth Hiring"
              autoFocus
            />
          </Field>
          <Field label="Job title" hint="Required">
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className={inputClass()}
              placeholder="e.g., Senior Front-End Engineer"
            />
          </Field>
        </div>

        <Field label="Job description" hint="Required">
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            className={textareaClass()}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Required skills" hint="Required • comma-separated">
            <input
              value={requiredSkills}
              onChange={(e) => setRequiredSkills(e.target.value)}
              className={inputClass()}
              placeholder="React, TypeScript, GraphQL"
            />
          </Field>
          <Field label="Employment type" hint="Required">
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
              className={selectClass()}
            >
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
            </select>
          </Field>
        </div>

        {error ? (
          <div className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
            <div className="font-semibold">Couldn’t save changes</div>
            <div className="mt-1">{error}</div>
          </div>
        ) : null}

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave || isSaving}
            className={[
              "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-white shadow-sm ring-1",
              canSave && !isSaving
                ? "bg-indigo-600 ring-indigo-500/20 hover:bg-indigo-500"
                : "bg-zinc-300 ring-zinc-200/70 text-white/80 cursor-not-allowed",
            ].join(" ")}
          >
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function DeleteCampaignModal({
  campaignId,
  campaignName,
  onClose,
  onDeleted,
}: {
  campaignId: string;
  campaignName: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <ModalShell
      title="Delete campaign"
      description="This action cannot be undone."
      onClose={() => {
        if (!isDeleting) onClose();
      }}
    >
      <div className="rounded-3xl bg-rose-50 p-4 ring-1 ring-rose-200/70">
        <div className="text-sm font-semibold text-rose-900">
          You’re about to delete “{campaignName}”.
        </div>
        <div className="mt-1 text-sm text-rose-800">
          This will permanently remove the campaign and its configuration.
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
          <div className="font-semibold">Couldn’t delete campaign</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={async () => {
            setIsDeleting(true);
            setError(null);
            const { error } = await supabase.from("campaigns").delete().eq("id", campaignId);
            if (error) {
              setError(error.message);
              setIsDeleting(false);
              return;
            }
            setIsDeleting(false);
            onDeleted();
          }}
          disabled={isDeleting}
          className={[
            "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-white shadow-sm ring-1",
            isDeleting
              ? "bg-rose-300 ring-rose-200/70 cursor-wait"
              : "bg-rose-600 ring-rose-500/20 hover:bg-rose-500",
          ].join(" ")}
        >
          {isDeleting ? "Deleting…" : "Delete campaign"}
        </button>
      </div>
    </ModalShell>
  );
}

