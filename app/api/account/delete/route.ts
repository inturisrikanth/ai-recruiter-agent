import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

async function deleteByUserId(
  billing: ReturnType<typeof createSupabaseServiceRoleClient>,
  table: string,
  userId: string,
) {
  const { error } = await billing.from(table).delete().eq("user_id", userId);
  if (error) throw new Error(`${table}: ${error.message}`);
}

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user.id;

  let billing: ReturnType<typeof createSupabaseServiceRoleClient>;
  try {
    billing = createSupabaseServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Missing service role configuration.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    // Child -> parent deletion order (best-effort safety for FK constraints).
    await deleteByUserId(billing, "campaign_call_candidates", userId);
    await deleteByUserId(billing, "campaign_call_sessions", userId);
    await deleteByUserId(billing, "campaign_call_setup_templates", userId);
    await deleteByUserId(billing, "call_configurations", userId);
    await deleteByUserId(billing, "campaign_candidate_lists", userId);
    await deleteByUserId(billing, "candidates", userId);
    await deleteByUserId(billing, "candidate_lists", userId);
    await deleteByUserId(billing, "campaigns", userId);
    await deleteByUserId(billing, "call_setup_templates", userId);
    await deleteByUserId(billing, "billing_invoices", userId);
    await deleteByUserId(billing, "credit_transactions", userId);
    await deleteByUserId(billing, "user_credits", userId);

    // profiles uses id (auth.users id) not user_id
    const { error: profileErr } = await billing.from("profiles").delete().eq("id", userId);
    if (profileErr) throw new Error(`profiles: ${profileErr.message}`);

    // Delete auth user last.
    const { error: authErr } = await billing.auth.admin.deleteUser(userId);
    if (authErr) throw new Error(`auth.users: ${authErr.message}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Clear cookies/session (best-effort).
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true }, { status: 200 });
}

