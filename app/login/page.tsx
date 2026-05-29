"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

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

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || "Couldn’t sign in.");

      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t sign in.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex w-full max-w-[520px] flex-col px-4 py-10 sm:px-6">
        <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
          <div className="text-sm font-medium text-zinc-500">Sign in</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Welcome back</h1>
          <p className="mt-1 text-sm text-zinc-600">Sign in to access your workspace.</p>
        </header>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
          <form className="grid gap-5" onSubmit={onSubmit}>
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
                  autoComplete="current-password"
                  placeholder="Your password"
                  required
                />
              </div>
            </label>

            {error ? (
              <div className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
                <div className="font-semibold text-rose-900">Couldn’t sign in</div>
                <div className="mt-1">{error}</div>
              </div>
            ) : null}

            <button type="submit" className={primaryButtonClass(isSaving)} disabled={isSaving}>
              {isSaving ? "Signing in…" : "Sign in"}
            </button>

            <div className="text-xs text-zinc-500">
              Having trouble? Check your credentials in Supabase Auth.{" "}
              <Link href="/" className="font-semibold text-zinc-700 hover:text-zinc-900">
                Go back
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

