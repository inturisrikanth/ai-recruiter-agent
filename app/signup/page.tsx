"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function inputClass() {
  return "h-11 w-full rounded-2xl bg-white px-4 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15";
}

function primaryButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-11 w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold shadow-sm ring-1 transition",
    disabled
      ? "bg-indigo-400 text-white ring-indigo-500/10 cursor-not-allowed"
      : "bg-indigo-600 text-white ring-indigo-500/20 hover:bg-indigo-500",
  ].join(" ");
}

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; code?: string; has_session?: boolean; needs_confirmation?: boolean }
        | null;
      if (!res.ok) {
        const code = String(payload?.code ?? "");
        const message = payload?.error || "Couldn’t sign up.";
        if (res.status === 429 || code === "email_rate_limit" || message.toLowerCase().includes("rate limit")) {
          throw new Error("Too many signup emails were requested. Please wait a few minutes before trying again.");
        }
        throw new Error(message);
      }

      if (payload?.has_session) {
        router.replace("/");
        router.refresh();
        return;
      }

      setSuccess("Account created. Please check your email to confirm your account, then log in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t sign up.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex w-full max-w-[520px] flex-col px-4 py-10 sm:px-6">
        <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
          <div className="text-sm font-medium text-zinc-500">Sign up</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Create your account</h1>
          <p className="mt-1 text-sm text-zinc-600">Start your recruiting workspace in minutes.</p>
        </header>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
          <form className="grid gap-5" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="text-sm font-semibold text-zinc-900">First name</div>
                <div className="mt-2">
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass()}
                    autoComplete="given-name"
                    placeholder="First name"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <div className="text-sm font-semibold text-zinc-900">Last name</div>
                <div className="mt-2">
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass()}
                    autoComplete="family-name"
                    placeholder="Last name"
                    required
                  />
                </div>
              </label>
            </div>

            <label className="block">
              <div className="text-sm font-semibold text-zinc-900">Email</div>
              <div className="mt-2">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass()}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-zinc-900">Password</div>
              <div className="mt-2">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass()}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Create a password"
                  required
                />
              </div>
            </label>

            {error ? (
              <div className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
                <div className="font-semibold text-rose-900">Couldn’t sign up</div>
                <div className="mt-1">{error}</div>
              </div>
            ) : null}

            {success ? (
              <div className="rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200/70">
                <div className="font-semibold text-emerald-900">Account created</div>
                <div className="mt-1">{success}</div>
                <div className="mt-3 text-sm">
                  <Link href="/login" className="font-semibold text-emerald-900 hover:text-emerald-950">
                    Go to login
                  </Link>
                </div>
              </div>
            ) : null}

            <button type="submit" className={primaryButtonClass(isSaving)} disabled={isSaving}>
              {isSaving ? "Creating account…" : "Create account"}
            </button>

            <div className="text-xs text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-zinc-700 hover:text-zinc-900">
                Sign in
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

