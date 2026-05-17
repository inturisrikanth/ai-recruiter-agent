import { AppShell } from "@/components/dashboard/AppShell";

export default function SettingsPage() {
  return (
    <AppShell>
      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 sm:p-6">
        <div className="text-sm font-medium text-zinc-500">Settings</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Configure your workspace preferences, notifications, and integrations.
        </p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
          <div className="text-sm font-semibold text-zinc-900">
            Organization profile
          </div>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Brand settings, recruiter seats, and shared templates (coming soon).
          </p>
          <button
            type="button"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200/70 hover:bg-zinc-50"
          >
            Manage org
          </button>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
          <div className="text-sm font-semibold text-zinc-900">Notifications</div>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Choose when to get alerts for replies, call bookings, and campaign health.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Configure notifications
          </button>
        </div>
      </section>
    </AppShell>
  );
}

