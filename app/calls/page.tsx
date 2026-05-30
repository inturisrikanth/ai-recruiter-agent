import { AppShell } from "@/components/dashboard/AppShell";
import { CallSetupTemplatesManager, type CallSetupTemplateRow } from "@/components/calls/CallSetupTemplatesManager";
import {
  CampaignCallSetupTemplatesSelector,
  type CallSetupTemplateRow as CampaignTemplateRow,
} from "@/components/calls/CampaignCallSetupTemplatesSelector";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Ensure fresh data in production (avoid static/cached HTML).
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getFirstQueryValue(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

export default async function CallsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = (await searchParams) ?? {};
  const campaignId = getFirstQueryValue(sp.campaignId);

  if (!campaignId) {
    const { data, error } = await supabase
      .from("call_setup_templates")
      .select("id,template_name,company_name,selected_questions,custom_questions,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return (
        <AppShell>
          <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
            <div className="text-sm font-medium text-zinc-500">Call setup</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              Call setup templates
            </h1>
            <p className="mt-1 text-sm text-zinc-600">Save reusable templates for AI recruiter calls.</p>
          </header>

          <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
            <div className="text-sm font-semibold text-rose-900">Couldn’t load templates</div>
            <div className="mt-1 text-sm text-rose-800">{error.message}</div>
            <div className="mt-3 text-sm text-rose-800">Try refreshing the page.</div>
          </div>
        </AppShell>
      );
    }

    const templates: CallSetupTemplateRow[] = (data ?? []).map((row) => ({
      id: String(row.id),
      templateName: String(row.template_name ?? "Call setup template"),
      companyName: String(row.company_name ?? ""),
      selectedQuestions: normalizeStringArray(row.selected_questions),
      customQuestions: normalizeStringArray(row.custom_questions),
      createdAt: String(row.created_at ?? new Date().toISOString()),
    }));

    return (
      <AppShell>
        <CallSetupTemplatesManager initialTemplates={templates} />
      </AppShell>
    );
  }

  const { data: templatesData, error: templatesError } = await supabase
    .from("call_setup_templates")
    .select("id,template_name,company_name,selected_questions,custom_questions,call_notes,created_at,updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const templates: CampaignTemplateRow[] = templatesError
    ? []
    : (templatesData ?? []).map((row) => ({
        id: String(row.id),
        templateName: String(row.template_name ?? "Call setup template"),
        companyName: String(row.company_name ?? ""),
        selectedQuestions: normalizeStringArray(row.selected_questions),
        customQuestions: normalizeStringArray(row.custom_questions),
        callNotes: row.call_notes ? String(row.call_notes) : null,
        createdAt: String(row.created_at ?? new Date().toISOString()),
      }));

  const { data: attached, error: attachedError } = await supabase
    .from("campaign_call_setup_templates")
    .select("call_setup_template_id")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .maybeSingle();

  const initialAttachedTemplateId =
    !attachedError && attached?.call_setup_template_id ? String(attached.call_setup_template_id) : null;

  const { data: existingCallConfig, error: existingCallConfigError } = await supabase
    .from("call_configurations")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .maybeSingle();

  const initialTemplateNotice =
    !existingCallConfigError && existingCallConfig?.id && !initialAttachedTemplateId
      ? "The previously selected template is missing. Please select a new template."
      : null;

  return (
    <AppShell>
      {templatesError ? (
        <div className="rounded-3xl bg-amber-50 p-5 text-sm text-amber-900 ring-1 ring-amber-200/70 sm:p-6">
          <div className="font-semibold">Couldn’t load templates</div>
          <div className="mt-1 text-amber-800">{templatesError.message}</div>
        </div>
      ) : (
        <CampaignCallSetupTemplatesSelector
          campaignId={campaignId}
          templates={templates}
          initialAttachedTemplateId={initialAttachedTemplateId}
          initialTemplateNotice={initialTemplateNotice}
        />
      )}
    </AppShell>
  );
}

