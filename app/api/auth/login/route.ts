import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

  return NextResponse.json({ ok: true }, { status: 200 });
}

