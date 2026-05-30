import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function deriveProfileNamesFromMetadata(user: { user_metadata?: unknown }) {
  const meta = user.user_metadata && typeof user.user_metadata === "object" ? (user.user_metadata as Record<string, unknown>) : null;
  const first = String(meta?.first_name ?? "").trim();
  const last = String(meta?.last_name ?? "").trim();
  if (first || last) return { first_name: first || null, last_name: last || null };

  const full = String(meta?.full_name ?? "").trim();
  if (!full) return { first_name: null, last_name: null };
  const parts = full.split(/\s+/).filter(Boolean);
  const firstFromFull = parts[0] ?? "";
  const lastFromFull = parts.slice(1).join(" ");
  return {
    first_name: firstFromFull ? firstFromFull : null,
    last_name: lastFromFull ? lastFromFull : null,
  };
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Missing Supabase env vars." }, { status: 500 });
  }

  const jar = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          jar.set(name, value, options);
        }
      },
    },
  });

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const email = payload && typeof payload === "object" && "email" in payload ? String((payload as { email?: unknown }).email ?? "") : "";
  const password =
    payload && typeof payload === "object" && "password" in payload ? String((payload as { password?: unknown }).password ?? "") : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // Credits foundation: ensure the user has a user_credits row.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: userError?.message ?? "Couldn’t load user after sign-in." }, { status: 500 });
  }

  const { data: existingCredits, error: existingCreditsError } = await supabase
    .from("user_credits")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingCreditsError) {
    return NextResponse.json({ error: existingCreditsError.message }, { status: 500 });
  }

  if (!existingCredits?.id) {
    const { error: createCreditsError } = await supabase.from("user_credits").insert({
      user_id: user.id,
      balance: 0,
      total_purchased: 0,
      total_used: 0,
    });
    if (createCreditsError) {
      return NextResponse.json({ error: createCreditsError.message }, { status: 500 });
    }
  }

  // Profile foundation: ensure the user has a profiles row.
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("id,first_name,last_name")
    .eq("id", user.id)
    .maybeSingle();
  if (existingProfileError) {
    return NextResponse.json({ error: existingProfileError.message }, { status: 500 });
  }

  const derived = deriveProfileNamesFromMetadata(user);

  if (!existingProfile?.id) {
    const { error: createProfileError } = await supabase.from("profiles").insert({
      id: user.id,
      first_name: derived.first_name,
      last_name: derived.last_name,
      company_name: null,
      role: "user",
    });
    const isDuplicate = String((createProfileError as { code?: unknown } | null)?.code ?? "") === "23505";
    if (createProfileError && !isDuplicate) {
      return NextResponse.json({ error: createProfileError.message }, { status: 500 });
    }
  } else {
    // Repair legacy profiles that exist but have missing names.
    // Do not overwrite non-empty user-edited values.
    const currentFirst = String((existingProfile as { first_name?: unknown } | null)?.first_name ?? "").trim();
    const currentLast = String((existingProfile as { last_name?: unknown } | null)?.last_name ?? "").trim();

    const next: Record<string, unknown> = {};
    if (!currentFirst && derived.first_name) next.first_name = derived.first_name;
    if (!currentLast && derived.last_name) next.last_name = derived.last_name;

    if (Object.keys(next).length) {
      next.updated_at = new Date().toISOString();
      const { error: updateErr } = await supabase.from("profiles").update(next).eq("id", user.id);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

