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
    setSuccess("Password reset email sent.");
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
    </div>
  );
}

