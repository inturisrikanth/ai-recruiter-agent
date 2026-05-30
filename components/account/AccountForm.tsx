"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function inputClass(disabled?: boolean) {
  return [
    "h-11 w-full rounded-2xl bg-white px-4 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15",
    disabled ? "bg-zinc-50 text-zinc-600" : "",
  ].join(" ");
}

export function AccountForm(props: {
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const [firstName, setFirstName] = useState(props.firstName ?? "");
  const [lastName, setLastName] = useState(props.lastName ?? "");
  const [companyName, setCompanyName] = useState(props.companyName ?? "");

  async function save() {
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        companyName: companyName.trim() || null,
      }),
    });
    const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok) {
      setError(payload?.error || "Couldn’t save profile.");
      return;
    }
    setSuccess("Saved.");
    router.refresh();
  }

  async function sendPasswordReset() {
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/account/password-reset", { method: "POST" });
    const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok) {
      setError(payload?.error || "Couldn’t send password reset email.");
      return;
    }
    setSuccess("Password reset email sent. Please check your inbox.");
  }

  async function deleteAccount() {
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/account/delete", { method: "POST" });
    const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok) {
      setError(payload?.error || "Couldn’t delete account.");
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <div className="text-sm font-semibold text-zinc-900">First name</div>
          <div className="mt-2">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass()} />
          </div>
        </label>
        <label className="block">
          <div className="text-sm font-semibold text-zinc-900">Last name</div>
          <div className="mt-2">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass()} />
          </div>
        </label>
      </div>

      <label className="block">
        <div className="text-sm font-semibold text-zinc-900">Company name</div>
        <div className="mt-2">
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass()} placeholder="Optional" />
        </div>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <div className="text-sm font-semibold text-zinc-900">Email</div>
          <div className="mt-2">
            <input value={props.email} readOnly className={inputClass(true)} />
          </div>
        </label>
      </div>

      {error ? (
        <div className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
          <div className="font-semibold text-rose-900">Something went wrong</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}
      {success ? <div className="rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200/70">{success}</div> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(save)}
          className={[
            "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold shadow-sm ring-1",
            isPending ? "cursor-not-allowed bg-zinc-100 text-zinc-500 ring-zinc-200/70" : "bg-indigo-600 text-white ring-indigo-500/20 hover:bg-indigo-500",
          ].join(" ")}
        >
          Save changes
        </button>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(sendPasswordReset)}
            className={[
              "inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50",
              isPending ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            Send password reset email
          </button>
        </div>
      </div>

      <div className="mt-2 rounded-3xl bg-rose-50/40 p-5 ring-1 ring-rose-200/70">
        <div className="text-sm font-semibold text-rose-900">Danger zone</div>
        <p className="mt-1 text-sm leading-6 text-rose-900/80">
          Deleting your account will remove your access and may delete your campaigns, candidates, reports, and billing data depending on system retention rules.
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            setSuccess(null);
            setDeleteText("");
            setDeleteOpen(true);
          }}
          className={[
            "mt-4 inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-rose-700 shadow-sm ring-1 ring-rose-200/70 hover:bg-rose-50",
            isPending ? "cursor-not-allowed opacity-60" : "",
          ].join(" ")}
        >
          Delete account
        </button>
      </div>

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-zinc-950/40"
            onClick={() => setDeleteOpen(false)}
          />
          <div className="relative w-[92vw] max-w-[480px] rounded-3xl bg-white p-6 shadow-xl ring-1 ring-zinc-200/70">
            <div className="text-sm font-semibold text-zinc-900">Confirm account deletion</div>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              This is permanent. Type <span className="font-semibold text-zinc-900">DELETE</span> to confirm.
            </p>
            <div className="mt-4">
              <input
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                className={inputClass()}
                placeholder="Type DELETE"
                autoComplete="off"
              />
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
                onClick={() => setDeleteOpen(false)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || deleteText.trim().toUpperCase() !== "DELETE"}
                onClick={() => startTransition(deleteAccount)}
                className={[
                  "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold shadow-sm ring-1",
                  isPending || deleteText.trim().toUpperCase() !== "DELETE"
                    ? "cursor-not-allowed bg-rose-200 text-rose-700 ring-rose-200/70"
                    : "bg-rose-600 text-white ring-rose-500/20 hover:bg-rose-500",
                ].join(" ")}
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

