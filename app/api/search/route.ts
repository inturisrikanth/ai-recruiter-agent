import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function normalizeQuery(input: string | null) {
  const q = String(input ?? "").trim();
  return q.length >= 2 ? q : "";
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const q = normalizeQuery(url.searchParams.get("q"));
  if (!q) {
    return NextResponse.json(
      { ok: true, campaigns: [], candidateLists: [], candidates: [], templates: [], reports: [] },
      { status: 200 },
    );
  }

  const like = `%${q}%`;
  const limit = 5;

  const [campaignsRes, listsRes, candidatesRes, templatesRes, reportsRes] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id,campaign_name,status,updated_at")
      .eq("user_id", user.id)
      .or(`campaign_name.ilike.${like},status.ilike.${like}`)
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("candidate_lists")
      .select("id,list_name,total_candidates,created_at")
      .eq("user_id", user.id)
      .ilike("list_name", like)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("candidates")
      .select("id,name,email,phone,list_id,created_at")
      .eq("user_id", user.id)
      .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("call_setup_templates")
      .select("id,template_name,company_name,created_at")
      .eq("user_id", user.id)
      .or(`template_name.ilike.${like},company_name.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(limit),
    // Reports V1: treat completed campaigns as having a report (reports page is built from completed sessions).
    supabase
      .from("campaigns")
      .select("id,campaign_name,status,updated_at")
      .eq("user_id", user.id)
      .eq("status", "Completed")
      .ilike("campaign_name", like)
      .order("updated_at", { ascending: false })
      .limit(limit),
  ]);

  // If any query errors, return a safe empty response with an error message.
  const err =
    campaignsRes.error ??
    listsRes.error ??
    candidatesRes.error ??
    templatesRes.error ??
    reportsRes.error ??
    null;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const campaigns = (campaignsRes.data ?? []).map((r) => ({
    id: String(r.id),
    name: String((r as { campaign_name?: unknown }).campaign_name ?? "Campaign"),
    status: String((r as { status?: unknown }).status ?? ""),
    href: `/campaigns/${encodeURIComponent(String(r.id))}`,
  }));

  const candidateLists = (listsRes.data ?? []).map((r) => ({
    id: String(r.id),
    name: String((r as { list_name?: unknown }).list_name ?? "Candidate list"),
    href: "/candidates",
  }));

  const candidates = (candidatesRes.data ?? []).map((r) => ({
    id: String(r.id),
    name: String((r as { name?: unknown }).name ?? "Candidate"),
    email: (r as { email?: unknown }).email ? String((r as { email?: unknown }).email) : null,
    phone: (r as { phone?: unknown }).phone ? String((r as { phone?: unknown }).phone) : null,
    href: `/candidates/${encodeURIComponent(String(r.id))}`,
  }));

  const templates = (templatesRes.data ?? []).map((r) => ({
    id: String(r.id),
    name: String((r as { template_name?: unknown }).template_name ?? "Template"),
    companyName: (r as { company_name?: unknown }).company_name ? String((r as { company_name?: unknown }).company_name) : null,
    href: `/calls/templates/${encodeURIComponent(String(r.id))}`,
  }));

  const reports = (reportsRes.data ?? []).map((r) => ({
    id: String(r.id),
    name: String((r as { campaign_name?: unknown }).campaign_name ?? "Campaign"),
    href: `/reports?campaignId=${encodeURIComponent(String(r.id))}`,
  }));

  return NextResponse.json(
    {
      ok: true,
      campaigns,
      candidateLists,
      candidates,
      templates,
      reports,
    },
    { status: 200 },
  );
}

