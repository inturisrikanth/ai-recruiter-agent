import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function pickNullableString(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object") return null;
  if (!(key in payload)) return null;
  const raw = String((payload as Record<string, unknown>)[key] ?? "").trim();
  return raw ? raw : null;
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

  const firstName = pickNullableString(payload, "firstName");
  const lastName = pickNullableString(payload, "lastName");
  const companyName = pickNullableString(payload, "companyName");

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      company_name: companyName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true }, { status: 200 });
}

