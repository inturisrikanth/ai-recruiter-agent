import { AppShell } from "@/components/dashboard/AppShell";
import { CallSetupTemplateForm, type CallSetupTemplateInitial } from "@/components/calls/CallSetupTemplateForm";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

function getFirstQueryValue(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function EditCallSetupTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { templateId } = await params;
  const sp = (await searchParams) ?? {};
  const returnTo = getFirstQueryValue(sp.returnTo) ?? null;
  const backHref = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/calls";

  const { data, error } = await supabase
    .from("call_setup_templates")
    .select("id,template_name,company_name,selected_questions,custom_questions,call_notes")
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    return (
      <AppShell>
        <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
          <div className="text-sm font-medium text-zinc-500">Call setup</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Edit template
          </h1>
          <p className="mt-1 text-sm text-zinc-600">Update a reusable call setup template.</p>
        </header>

        <div className="mt-6 rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70 sm:p-6">
          <div className="text-sm font-semibold text-rose-900">Couldn’t load template</div>
          <div className="mt-1 text-sm text-rose-800">{error.message}</div>
          <div className="mt-4">
            <Link
              href={backHref}
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
            >
              Back to templates
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!data) notFound();

  const initial: CallSetupTemplateInitial = {
    id: String(data.id),
    templateName: String(data.template_name ?? "Call setup template"),
    companyName: data.company_name ? String(data.company_name) : null,
    selectedQuestions: normalizeStringArray(data.selected_questions),
    customQuestions: normalizeStringArray(data.custom_questions),
    callNotes: data.call_notes ? String(data.call_notes) : null,
  };

  return (
    <AppShell>
      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-500">Call setup</div>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              {initial.templateName}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">Edit reusable call setup template.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={backHref}
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
            >
              Back to templates
            </Link>
          </div>
        </div>
      </header>

      <section className="mt-6">
        <CallSetupTemplateForm mode="edit" templateId={templateId} initial={initial} returnTo={returnTo} />
      </section>
    </AppShell>
  );
}

