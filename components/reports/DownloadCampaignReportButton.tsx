"use client";

import { useState } from "react";

function getFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  // Examples:
  // - attachment; filename="campaign-report-abc-20260528-123000.doc"
  // - attachment; filename=campaign-report-abc.doc
  const m = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(header);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function downloadButtonClass(disabled?: boolean) {
  return [
    "inline-flex h-11 min-w-[168px] shrink-0 items-center justify-center whitespace-nowrap rounded-full px-5 text-sm font-semibold shadow-sm ring-1 transition",
    disabled
      ? "bg-emerald-200 text-emerald-900/70 ring-emerald-200/70 cursor-not-allowed"
      : "bg-emerald-600 text-white ring-emerald-500/20 hover:bg-emerald-500",
  ].join(" ");
}

export function DownloadCampaignReportButton({ campaignId }: { campaignId: string }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (isDownloading) return;
    setIsDownloading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/campaign-download?campaignId=${encodeURIComponent(campaignId)}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error ?? "Couldn’t download report.")
            : `Couldn’t download report (HTTP ${res.status}).`;
        throw new Error(message);
      }

      const blob = await res.blob();
      const headerFilename = getFilenameFromContentDisposition(res.headers.get("content-disposition"));
      const fallbackFilename = `campaign-report-${campaignId}-${new Date().toISOString().replace(/[:.]/g, "-")}.doc`;
      const filename = headerFilename || fallbackFilename;

      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t download report.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        className={downloadButtonClass(isDownloading)}
        disabled={isDownloading}
        onClick={onClick}
      >
        {isDownloading ? "Downloading…" : "Download Report"}
      </button>
      {error ? <div className="text-xs font-semibold text-rose-700">{error}</div> : null}
    </div>
  );
}

