import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function pickString(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object") return "";
  if (!(key in payload)) return "";
  return String((payload as Record<string, unknown>)[key] ?? "").trim();
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

  const firstName = pickString(payload, "firstName");
  const lastName = pickString(payload, "lastName");
  const email = pickString(payload, "email");
  const password = pickString(payload, "password");

  if (!firstName || !lastName || !email || !password) {
    return NextResponse.json({ error: "First name, last name, email, and password are required." }, { status: 400 });
  }

  const { data: signupData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
      },
    },
  });

  if (error) {
    const msg = error.message || "Couldn’t sign up.";
    const lower = msg.toLowerCase();
    const isRateLimit =
      (lower.includes("rate") && lower.includes("limit")) ||
      lower.includes("too many requests") ||
      lower.includes("email rate limit");
    if (isRateLimit) {
      return NextResponse.json({ error: msg, code: "email_rate_limit" }, { status: 429 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const hasSession = Boolean(signupData.session);
  const needsConfirmation = !hasSession;

  return NextResponse.json(
    {
      ok: true,
      has_session: hasSession,
      needs_confirmation: needsConfirmation,
    },
    { status: 200 },
  );
}

