import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = user.email ?? null;
  if (!email) return NextResponse.json({ error: "Email not available for this user." }, { status: 400 });

  const appUrlRaw = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "").trim();
  const appUrl = appUrlRaw.replace(/\/+$/, "");
  const redirectToFromEnv = appUrl ? `${appUrl}/reset-password` : null;

  const h = await headers();
  const origin = h.get("origin") ?? h.get("x-forwarded-host") ?? null;
  const redirectToFromOrigin = origin
    ? origin.startsWith("http")
      ? `${origin}/reset-password`
      : `https://${origin}/reset-password`
    : null;

  const redirectTo = redirectToFromEnv ?? redirectToFromOrigin ?? undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 200 });
}

