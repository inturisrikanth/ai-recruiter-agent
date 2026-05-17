type QuickActionCardProps = {
  title: string;
  description: string;
};

export function QuickActionCard({ title, description }: QuickActionCardProps) {
  return (
    <button
      type="button"
      className="group rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-zinc-200/70 transition hover:shadow-md hover:ring-zinc-200"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-zinc-900">{title}</div>
        <span className="grid size-9 place-items-center rounded-2xl bg-zinc-50 ring-1 ring-zinc-200/70 text-zinc-700 group-hover:bg-white">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none">
            <path
              d="M8 12h8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M12 8v8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </div>
      <div className="mt-2 text-sm leading-6 text-zinc-600">{description}</div>
    </button>
  );
}

