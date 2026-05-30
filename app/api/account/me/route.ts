import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function computeInitials(opts: { firstName: string | null; lastName: string | null; email: string | null }) {
  const first = (opts.firstName ?? "").trim();
  const last = (opts.lastName ?? "").trim();
  const email = (opts.email ?? "").trim();

  const a = first ? first[0] ?? "" : "";
  const b = last ? last[0] ?? "" : "";
  const fromName = (a + b).toUpperCase();
  if (fromName.trim()) return fromName;

  if (email) {
    const local = email.split("@")[0] ?? "";
    const letters = local.replaceAll(/[^a-zA-Z0-9]/g, "");
    const i = (letters.slice(0, 2) || local.slice(0, 2)).toUpperCase();
    if (i.trim()) return i;
  }

  return "U";
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ initials: "U" }, { status: 200 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name,last_name")
    .eq("id", user.id)
    .maybeSingle();

  const firstName = profile ? String((profile as { first_name?: unknown }).first_name ?? "").trim() || null : null;
  const lastName = profile ? String((profile as { last_name?: unknown }).last_name ?? "").trim() || null : null;

  const initials = computeInitials({ firstName, lastName, email: user.email ?? null });
  return NextResponse.json({ initials, email: user.email ?? null }, { status: 200 });
}

