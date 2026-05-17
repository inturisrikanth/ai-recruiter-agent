type StatCardProps = {
  label: string;
  value: string;
  delta: string;
  badgeLabel?: string;
  accent?: "indigo" | "emerald" | "sky" | "amber" | "rose" | "zinc";
};

function badgeClasses(accent: NonNullable<StatCardProps["accent"]>) {
  switch (accent) {
    case "emerald":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
    case "sky":
      return "bg-sky-50 text-sky-700 ring-sky-200/70";
    case "amber":
      return "bg-amber-50 text-amber-700 ring-amber-200/70";
    case "rose":
      return "bg-rose-50 text-rose-700 ring-rose-200/70";
    case "zinc":
      return "bg-zinc-100 text-zinc-700 ring-zinc-200/80";
    case "indigo":
    default:
      return "bg-indigo-50 text-indigo-700 ring-indigo-200/70";
  }
}

export function StatCard({
  label,
  value,
  delta,
  badgeLabel = "Live",
  accent = "indigo",
}: StatCardProps) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/70">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-zinc-500">{label}</div>
        <span
          className={[
            "rounded-full px-2 py-1 text-xs font-medium ring-1",
            badgeClasses(accent),
          ].join(" ")}
        >
          {badgeLabel}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
        {value}
      </div>
      <div className="mt-1 text-sm text-zinc-600">{delta}</div>
    </div>
  );
}

