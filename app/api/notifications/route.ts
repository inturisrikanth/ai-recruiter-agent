import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: notifications, error }, { count: unreadCount, error: countErr }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id,type,title,message,related_campaign_id,related_url,is_read,created_at,read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, unreadCount: Number(unreadCount ?? 0), notifications: notifications ?? [] }, { status: 200 });
}

