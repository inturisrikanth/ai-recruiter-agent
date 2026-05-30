"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

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

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type");

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [linkState, setLinkState] = useState<"loading" | "ready" | "invalid">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function sleep(ms: number) {
      await new Promise((r) => setTimeout(r, ms));
    }

    async function initFromUrl() {
      try {
        let didAttempt = false;

        // PKCE flow: ?code=...
        if (code) {
          didAttempt = true;
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (!exErr) window.history.replaceState({}, "", "/reset-password");
        }

        // token_hash flow: ?token_hash=...&type=recovery
        if (!code && tokenHash && type === "recovery") {
          didAttempt = true;
          const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (!otpErr) window.history.replaceState({}, "", "/reset-password");
        }

        if (!code && !(tokenHash && type === "recovery") && typeof window !== "undefined" && window.location.hash) {
          // Implicit flow: #access_token=...&refresh_token=...&type=recovery
          const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
          const h = new URLSearchParams(hash);
          const accessToken = h.get("access_token");
          const refreshToken = h.get("refresh_token");
          if (accessToken && refreshToken) {
            didAttempt = true;
            const { error: setErr } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (!setErr) window.history.replaceState({}, "", "/reset-password");
          }
        }

        // Give the client a moment to persist/rehydrate the recovery session before declaring invalid.
        // We retry a few times (works around async session propagation in some environments).
        const waits = didAttempt ? [0, 150, 300, 600, 1200] : [0, 150, 300];
        for (const w of waits) {
          if (w) await sleep(w);
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            if (!cancelled) setLinkState("ready");
            return;
          }
        }

        if (!cancelled) setLinkState("invalid");
      } catch {
        if (!cancelled) setLinkState("invalid");
      }
    }

    initFromUrl();
    return () => {
      cancelled = true;
    };
  }, [code, tokenHash, type, supabase]);

  function validate() {
    const p = password.trim();
    const c = confirm.trim();
    if (!p) return "Password is required.";
    if (p.length < 8) return "Password must be at least 8 characters.";
    if (p !== c) return "Passwords do not match.";
    return null;
  }

  async function onUpdate() {
    setError(null);
    setSuccess(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: password.trim() });
    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    // For security, sign out and ask them to log in again.
    await supabase.auth.signOut();
    setSuccess("Password updated. Please log in again.");
    setTimeout(() => {
      router.replace("/login");
      router.refresh();
    }, 800);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex w-full max-w-[520px] flex-col px-4 py-10 sm:px-6">
        <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
          <div className="text-sm font-medium text-zinc-500">Account security</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Reset password</h1>
          <p className="mt-1 text-sm text-zinc-600">Choose a new password for your account.</p>
        </header>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 sm:p-7">
          {linkState === "loading" ? (
            <div className="text-sm text-zinc-700">Loading reset link…</div>
          ) : linkState === "invalid" ? (
            <div className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
              <div className="font-semibold text-rose-900">Reset link is invalid or expired</div>
              <div className="mt-1">Request a new password reset email from your Account page.</div>
              <div className="mt-3">
                <Link href="/login" className="font-semibold text-rose-900 hover:text-rose-950">
                  Go to login
                </Link>
              </div>
            </div>
          ) : (
            <form
              className="grid gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (isPending) return;
                startTransition(onUpdate);
              }}
            >
              <label className="block">
                <div className="text-sm font-semibold text-zinc-900">New password</div>
                <div className="mt-2">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass()}
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <div className="text-sm font-semibold text-zinc-900">Confirm password</div>
                <div className="mt-2">
                  <input
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={inputClass()}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm password"
                    required
                  />
                </div>
              </label>

              {error ? (
                <div className="rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
                  <div className="font-semibold text-rose-900">Couldn’t update password</div>
                  <div className="mt-1">{error}</div>
                </div>
              ) : null}
              {success ? (
                <div className="rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200/70">
                  <div className="font-semibold text-emerald-900">Success</div>
                  <div className="mt-1">{success}</div>
                </div>
              ) : null}

              <button type="submit" className={primaryButtonClass(isPending)} disabled={isPending}>
                {isPending ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

