import { AppShell } from "@/components/dashboard/AppShell";
import { CallSetupTemplateForm } from "@/components/calls/CallSetupTemplateForm";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getFirstQueryValue(value: string | string[] | undefined) {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewCallSetupTemplatePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const returnTo = getFirstQueryValue(sp.returnTo) ?? null;
  const backHref = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/calls";

  return (
    <AppShell>
      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-medium text-zinc-500">Call setup</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              New template
            </h1>
            <p className="mt-1 text-sm text-zinc-600">Create a reusable call setup template.</p>
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
        <CallSetupTemplateForm mode="create" returnTo={returnTo} />
      </section>
    </AppShell>
  );
}

