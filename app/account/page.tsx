import { AppShell } from "@/components/dashboard/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/account/AccountForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userId = user.id;

  const profileRes = await supabase
    .from("profiles")
    .select("first_name,last_name,company_name")
    .eq("id", userId)
    .maybeSingle();

  let profile = profileRes.data ?? null;
  const profileError = profileRes.error;

  if (profileError) {
    // If RLS blocks this, the rest of the app will also be broken; surface a safe redirect.
    redirect("/login");
  }

  if (!profile) {
    const meta = user.user_metadata && typeof user.user_metadata === "object" ? (user.user_metadata as Record<string, unknown>) : null;
    const firstFromMeta = String(meta?.first_name ?? "").trim() || null;
    const lastFromMeta = String(meta?.last_name ?? "").trim() || null;
    const { error: insertErr } = await supabase.from("profiles").insert({
      id: userId,
      first_name: firstFromMeta,
      last_name: lastFromMeta,
      company_name: null,
      role: "user",
    });
    const isDuplicate = String((insertErr as { code?: unknown } | null)?.code ?? "") === "23505";
    if (insertErr && !isDuplicate) redirect("/login");

    const res = await supabase
      .from("profiles")
      .select("first_name,last_name,company_name")
      .eq("id", userId)
      .maybeSingle();
    profile = res.data ?? null;
  }

  const email = user.email ?? "";
  const firstName = profile ? String((profile as { first_name?: unknown }).first_name ?? "").trim() || null : null;
  const lastName = profile ? String((profile as { last_name?: unknown }).last_name ?? "").trim() || null : null;
  const companyName = profile ? String((profile as { company_name?: unknown }).company_name ?? "").trim() || null : null;

  return (
    <AppShell>
      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
        <div className="text-sm font-medium text-zinc-500">Account</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-zinc-600">Manage your profile details and account security.</p>
      </header>

      <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
        <AccountForm email={email} firstName={firstName} lastName={lastName} companyName={companyName} />
      </section>
    </AppShell>
  );
}

