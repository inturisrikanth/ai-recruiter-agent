export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="h-[420px] rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70" />
        </aside>

        <main className="min-w-0">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70">
            <div className="h-4 w-44 rounded-full bg-zinc-100" />
            <div className="mt-3 h-8 w-[420px] max-w-full rounded-2xl bg-zinc-100" />
            <div className="mt-3 h-4 w-56 rounded-full bg-zinc-100" />
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70 lg:col-span-2">
              <div className="h-4 w-32 rounded-full bg-zinc-100" />
              <div className="mt-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-4 w-full rounded-full bg-zinc-100" />
                ))}
              </div>
              <div className="mt-6 h-4 w-28 rounded-full bg-zinc-100" />
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-7 w-24 rounded-full bg-zinc-100" />
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70">
              <div className="h-4 w-20 rounded-full bg-zinc-100" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-3xl bg-zinc-50 ring-1 ring-zinc-200/70" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

