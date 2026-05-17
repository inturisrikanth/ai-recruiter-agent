export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="h-[420px] rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200/70" />
        </aside>

        <main className="min-w-0">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70">
            <div className="h-4 w-28 rounded-full bg-zinc-100" />
            <div className="mt-3 h-8 w-56 rounded-2xl bg-zinc-100" />
            <div className="mt-3 h-4 w-[420px] max-w-full rounded-full bg-zinc-100" />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/70"
              >
                <div className="h-4 w-28 rounded-full bg-zinc-100" />
                <div className="mt-3 h-7 w-20 rounded-2xl bg-zinc-100" />
                <div className="mt-2 h-4 w-36 rounded-full bg-zinc-100" />
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="h-4 w-32 rounded-full bg-zinc-100" />
                <div className="mt-2 h-4 w-64 rounded-full bg-zinc-100" />
              </div>
              <div className="h-11 w-[280px] rounded-full bg-zinc-100" />
            </div>
            <div className="mt-5 h-[320px] rounded-3xl bg-zinc-50 ring-1 ring-zinc-200/70" />
          </div>
        </main>
      </div>
    </div>
  );
}

