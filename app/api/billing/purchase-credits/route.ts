import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

function parseCredits(input: unknown) {
  const n = typeof input === "number" ? input : Number(String(input ?? "").trim());
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  if (n < 1) return null;
  return n;
}

function invoiceNumber(now: Date, txId: string) {
  const ymd = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = txId.replaceAll("-", "").slice(0, 8).toUpperCase();
  return `INV-${ymd}-${suffix}`;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }
  const credits = parseCredits((payload as { credits?: unknown } | null)?.credits);
  if (!credits) {
    return NextResponse.json(
      { error: "Enter a whole number of credits (minimum 1)." },
      { status: 400 },
    );
  }

  const userId = user.id;
  const now = new Date();
  const nowIso = now.toISOString();

  // Update user_credits with a lightweight CAS retry to avoid lost updates on rapid clicks.
  let updated = false;
  let resultingBalance: number | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: row, error: loadErr } = await supabase
      .from("user_credits")
      .select("balance,total_purchased")
      .eq("user_id", userId)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 403 });
    }

    const balance = Number((row as { balance?: unknown } | null)?.balance ?? 0);
    const totalPurchased = Number((row as { total_purchased?: unknown } | null)?.total_purchased ?? 0);

    const nextBalance = balance + credits;
    const nextTotalPurchased = totalPurchased + credits;

    const { data: updatedRows, error: updateErr } = await supabase
      .from("user_credits")
      .update({ balance: nextBalance, total_purchased: nextTotalPurchased, updated_at: nowIso })
      .eq("user_id", userId)
      .eq("balance", balance)
      .eq("total_purchased", totalPurchased)
      .select("balance")
      .limit(1);

    if (!updateErr && updatedRows?.length) {
      updated = true;
      resultingBalance = nextBalance;
      break;
    }

    // If the row doesn't exist yet, try creating it once.
    if (!row && attempt === 0) {
      const { error: insertErr } = await supabase.from("user_credits").insert({
        user_id: userId,
        balance: credits,
        total_purchased: credits,
        total_used: 0,
        created_at: nowIso,
        updated_at: nowIso,
      });
      if (!insertErr) {
        updated = true;
        resultingBalance = credits;
        break;
      }
    }
  }

  if (!updated) {
    return NextResponse.json({ error: "Could not update credits. Please try again." }, { status: 409 });
  }

  const txId = randomUUID();
  const invId = randomUUID();
  const invNumber = invoiceNumber(now, txId);

  const { error: txErr } = await supabase.from("credit_transactions").insert({
    id: txId,
    user_id: userId,
    campaign_id: null,
    type: "purchase",
    description: "Credit purchase",
    credits,
    amount_usd: credits,
    status: "completed",
  });
  if (txErr) {
    return NextResponse.json({ error: txErr.message }, { status: 403 });
  }

  const { error: invErr } = await supabase.from("billing_invoices").insert({
    id: invId,
    user_id: userId,
    transaction_id: txId,
    invoice_number: invNumber,
    amount_usd: credits,
    credits,
    status: "paid",
    invoice_url: null,
  });

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 403 });
  }

  // Notifications: one per purchase transaction (idempotent by using txId as notification id).
  await supabase.from("notifications").insert({
    id: txId,
    user_id: userId,
    type: "credit_purchase_completed",
    title: "Credits added",
    message: `${credits} credits were added to your account.`,
    related_campaign_id: null,
    related_url: "/finances",
    is_read: false,
  });

  // If balance is back above low-credit threshold, clear any unread low-credit warning.
  if (resultingBalance != null && resultingBalance >= 10) {
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: nowIso })
      .eq("user_id", userId)
      .eq("type", "low_credits")
      .eq("is_read", false);
  }

  return NextResponse.json({ ok: true, transaction_id: txId, invoice_number: invNumber, credits });
}

