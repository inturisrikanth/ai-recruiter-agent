import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

function escapeHtml(value: unknown) {
  const s = String(value ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

function labelCallStatus(value: unknown) {
  const s = normalize(value);
  if (!s) return "Not available";
  if (s === "completed" || s === "done") return "Completed";
  if (s === "no_answer" || s === "no-answer" || s === "voicemail") return "No answer";
  if (s === "failed") return "Failed";
  if (s === "retry_scheduled") return "Retry scheduled";
  if (s === "callback_scheduled") return "Callback scheduled";
  if (s === "queued") return "Queued";
  if (s === "calling" || s === "running" || s === "in_progress") return "Calling";
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function interestKind(value: unknown): "interested" | "not_interested" | "unknown" {
  const s = normalize(value);
  if (!s) return "unknown";
  if (s.includes("interested") && !s.includes("not")) return "interested";
  if (s.includes("not_interested") || s.includes("not interested") || s === "no" || s === "reject") return "not_interested";
  if (s === "unknown" || s === "unsure" || s === "neutral") return "unknown";
  return "unknown";
}

function interestLabel(value: unknown) {
  const k = interestKind(value);
  if (k === "interested") return "Interested";
  if (k === "not_interested") return "Not interested";
  return "Unknown";
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not available";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFileTimestamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(
    date.getUTCMinutes(),
  )}${pad(date.getUTCSeconds())}`;
}

function safeFilenamePiece(input: string) {
  const base = input.trim().toLowerCase() || "campaign";
  // Keep it filesystem-friendly (and simple for Content-Disposition filename=).
  return base
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function formatNotAvailable(value: unknown) {
  const s = String(value ?? "").trim();
  return s ? s : "Not available";
}

type TranscriptTurn = { speaker: "Agent" | "User"; text: string };

function cleanInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseTranscriptTurns(transcript: string | null): TranscriptTurn[] {
  const raw = String(transcript ?? "").trim();
  if (!raw) return [];

  const speakerLineRegex =
    /^(agent|assistant|ai|recruiter|bot|system|caller|user|candidate|callee|human)\s*[:\-]\s*(.+)$/i;

  function toSpeaker(labelRaw: string): TranscriptTurn["speaker"] {
    const label = labelRaw.toLowerCase();
    return label === "user" || label === "candidate" || label === "callee" || label === "human" ? "User" : "Agent";
  }

  const turns: TranscriptTurn[] = [];

  if (/\r?\n/.test(raw)) {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const m = speakerLineRegex.exec(line);
      if (m) {
        const speaker = toSpeaker(String(m[1] ?? ""));
        const content = cleanInlineText(String(m[2] ?? ""));
        if (!content) continue;
        const prev = turns[turns.length - 1];
        if (prev && prev.speaker === speaker) prev.text = cleanInlineText(`${prev.text} ${content}`);
        else turns.push({ speaker, text: content });
        continue;
      }

      const content = cleanInlineText(line);
      if (!content) continue;
      const prev = turns[turns.length - 1];
      if (prev) prev.text = cleanInlineText(`${prev.text} ${content}`);
      else turns.push({ speaker: "User", text: content });
    }

    return turns;
  }

  const markerRegex = /(agent|assistant|ai|recruiter|bot|system|caller|user|candidate|callee|human)\s*[:\-]\s*/gi;
  const matches = Array.from(raw.matchAll(markerRegex));
  if (!matches.length) return [{ speaker: "User", text: raw }];

  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const speaker = toSpeaker(String(m[1] ?? ""));
    const start = (m.index ?? 0) + String(m[0] ?? "").length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
    const segment = cleanInlineText(raw.slice(start, end));
    if (!segment) continue;
    const prev = turns[turns.length - 1];
    if (prev && prev.speaker === speaker) prev.text = cleanInlineText(`${prev.text} ${segment}`);
    else turns.push({ speaker, text: segment });
  }

  return turns.length ? turns : [{ speaker: "User", text: raw }];
}

function buildWordHtmlDocument(opts: {
  title: string;
  campaign: {
    id: string;
    name: string;
    jobTitle: string;
    status: string;
    updatedAt: string | null;
  };
  report: {
    generatedAt: string;
    lastUpdated: string | null;
    totalCalls: number;
    completed: number;
    noAnswer: number;
    failed: number;
    interested: number;
    notInterested: number;
    unknownInterest: number;
  };
  candidates: Array<{
    id: string;
    candidate_name: string | null;
    candidate_phone: string | null;
    candidate_email: string | null;
    call_status: string | null;
    interest_status: string | null;
    call_date: string | null;
    updated_at: string | null;
    created_at: string | null;
    transcript: string | null;
  }>;
}) {
  const { title, campaign, report, candidates } = opts;

  const docTitle = escapeHtml(title);
  const campaignName = escapeHtml(campaign.name);
  const jobTitle = escapeHtml(formatNotAvailable(campaign.jobTitle));
  const campaignStatus = escapeHtml(formatNotAvailable(campaign.status));
  const lastUpdated = escapeHtml(report.lastUpdated ? formatDateTime(report.lastUpdated) : "Not available");
  const generatedAt = escapeHtml(formatDateTime(report.generatedAt));

  const rows = candidates
    .map((c, idx) => {
      const candidateName = escapeHtml(formatNotAvailable(c.candidate_name));
      const phone = escapeHtml(formatNotAvailable(c.candidate_phone));
      const email = escapeHtml(formatNotAvailable(c.candidate_email));
      const callStatus = escapeHtml(labelCallStatus(c.call_status));
      const interest = escapeHtml(interestLabel(c.interest_status));
      const callDate = escapeHtml(
        c.call_date
          ? formatDateTime(c.call_date)
          : c.updated_at
            ? formatDateTime(c.updated_at)
            : c.created_at
              ? formatDateTime(c.created_at)
              : "Not available",
      );

      const transcriptText = String(c.transcript ?? "").trim();

      const turns = parseTranscriptTurns(transcriptText);
      const transcriptHtml = turns.length
        ? `<div class="transcript">${turns
            .map((t) => {
              const speaker = escapeHtml(t.speaker);
              const message = escapeHtml(String(t.text ?? "")).replace(/\r?\n/g, "<br />");
              return `<div class="turn"><div class="speaker">${speaker}:</div><div class="message">${message}</div></div>`;
            })
            .join("")}</div>`
        : `<div class="muted">Transcript not available.</div>`;

      return `
        <div class="candidate">
          <h2>Candidate ${idx + 1}: ${candidateName}</h2>
          <table class="kv">
            <tr><th>Phone</th><td>${phone}</td></tr>
            <tr><th>Email</th><td>${email}</td></tr>
            <tr><th>Call status</th><td>${callStatus}</td></tr>
            <tr><th>Interest</th><td>${interest}</td></tr>
            <tr><th>Last updated / call date</th><td>${callDate}</td></tr>
          </table>

          <h3>Full conversation transcript</h3>
          ${transcriptHtml}
        </div>
        ${idx < candidates.length - 1 ? `<div class="divider"></div>` : ``}
      `.trim();
    })
    .join("\n");

  const summaryBlock = `
    <h2>Campaign summary</h2>
    <table class="kv">
      <tr><th>Total calls</th><td>${escapeHtml(String(report.totalCalls))}</td></tr>
      <tr><th>Completed</th><td>${escapeHtml(String(report.completed))}</td></tr>
      <tr><th>No answer</th><td>${escapeHtml(String(report.noAnswer))}</td></tr>
      <tr><th>Failed</th><td>${escapeHtml(String(report.failed))}</td></tr>
      <tr><th>Interest</th><td>${escapeHtml(`${report.interested}/${report.notInterested}/${report.unknownInterest}`)}</td></tr>
    </table>
  `.trim();

  const detailsBlock = `
    <h2>Campaign details</h2>
    <table class="kv">
      <tr><th>Campaign name</th><td>${campaignName}</td></tr>
      <tr><th>Job title</th><td>${jobTitle}</td></tr>
      <tr><th>Campaign status</th><td>${campaignStatus}</td></tr>
      <tr><th>Last updated</th><td>${lastUpdated}</td></tr>
      <tr><th>Generated</th><td>${generatedAt}</td></tr>
    </table>
  `.trim();

  // Word-compatible HTML document.
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8" />
    <title>${docTitle}</title>
    <style>
      body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #111827; }
      h1 { font-size: 20pt; margin: 0 0 12pt; }
      h2 { font-size: 14pt; margin: 18pt 0 8pt; }
      h3 { font-size: 12pt; margin: 12pt 0 6pt; }
      .muted { color: #6b7280; }
      .kv { width: 100%; border-collapse: collapse; margin-top: 6pt; }
      .kv th { text-align: left; width: 220px; padding: 6pt 8pt; background: #f4f4f5; border: 1px solid #e4e4e7; vertical-align: top; }
      .kv td { padding: 6pt 8pt; border: 1px solid #e4e4e7; vertical-align: top; }
      .transcript { border: 1px solid #e4e4e7; background: #fafafa; padding: 8pt; margin-top: 6pt; }
      .turn { margin: 10pt 0; }
      .turn:first-child { margin-top: 0; }
      .turn:last-child { margin-bottom: 0; }
      .speaker { font-weight: 700; }
      .message { margin-top: 2pt; }
      .divider { height: 1px; background: #e5e7eb; margin: 18pt 0; }
      .candidate { page-break-inside: avoid; }
    </style>
  </head>
  <body>
    <h1>Campaign Report</h1>
    ${detailsBlock}
    ${summaryBlock}
    <h2>Candidate sections</h2>
    ${rows || `<div class="muted">No candidates available.</div>`}
  </body>
</html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const campaignId = String(url.searchParams.get("campaignId") ?? "");

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId." }, { status: 400 });

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,campaign_name,job_title,status,updated_at")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });
  if (!campaign?.id) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const { data: sessionsData, error: sessionsError } = await supabase
    .from("campaign_call_sessions")
    .select("id,status,total_candidates,completed_at,updated_at,created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (sessionsError) return NextResponse.json({ error: sessionsError.message }, { status: 500 });

  const session =
    (sessionsData ?? []).find((s) => String((s as { status?: unknown }).status ?? "").toLowerCase() === "completed") ??
    (sessionsData ?? [])[0] ??
    null;

  if (!session?.id) return NextResponse.json({ error: "No report data yet for this campaign." }, { status: 409 });

  const sessionId = String(session.id);

  const { data: candidateRows, error: candidateError } = await supabase
    .from("campaign_call_candidates")
    .select(
      "id,candidate_name,candidate_phone,candidate_email,interest_status,call_status,call_completed_at,updated_at,created_at,transcript",
    )
    .eq("call_session_id", sessionId)
    .order("candidate_name", { ascending: true })
    .limit(5000);

  if (candidateError) return NextResponse.json({ error: candidateError.message }, { status: 500 });

  const candidates = (candidateRows ?? []).map((r) => ({
    id: String(r.id),
    candidate_name: r.candidate_name ? String(r.candidate_name) : null,
    candidate_phone: r.candidate_phone ? String(r.candidate_phone) : null,
    candidate_email: r.candidate_email ? String(r.candidate_email) : null,
    interest_status: (r as { interest_status?: unknown }).interest_status ? String((r as { interest_status?: unknown }).interest_status) : null,
    call_status: (r as { call_status?: unknown }).call_status ? String((r as { call_status?: unknown }).call_status) : null,
    call_date: (r as { call_completed_at?: unknown }).call_completed_at ? String((r as { call_completed_at?: unknown }).call_completed_at) : null,
    updated_at: r.updated_at ? String(r.updated_at) : null,
    created_at: r.created_at ? String(r.created_at) : null,
    transcript: (r as { transcript?: unknown }).transcript ? String((r as { transcript?: unknown }).transcript) : null,
  }));

  let completed = 0;
  let noAnswer = 0;
  let failed = 0;
  let interested = 0;
  let notInterested = 0;
  let unknownInterest = 0;

  for (const c of candidates) {
    const status = normalize(c.call_status);
    if (status === "completed" || status === "done") completed += 1;
    else if (status === "no_answer" || status === "no-answer" || status === "voicemail") noAnswer += 1;
    else if (status === "failed") failed += 1;

    const ik = interestKind(c.interest_status);
    if (ik === "interested") interested += 1;
    else if (ik === "not_interested") notInterested += 1;
    else unknownInterest += 1;
  }

  const totalCalls = Number((session as { total_candidates?: unknown }).total_candidates ?? candidates.length ?? 0);
  const lastUpdatedRaw =
    String((session as { completed_at?: unknown }).completed_at ?? "") ||
    String((session as { updated_at?: unknown }).updated_at ?? "") ||
    String((session as { created_at?: unknown }).created_at ?? "");
  const lastUpdated = lastUpdatedRaw ? lastUpdatedRaw : (campaign.updated_at ? String(campaign.updated_at) : null);
  const generatedAt = new Date();

  const html = buildWordHtmlDocument({
    title: "Campaign Report",
    campaign: {
      id: String(campaign.id),
      name: String(campaign.campaign_name ?? "Campaign"),
      jobTitle: String(campaign.job_title ?? ""),
      status: String(campaign.status ?? ""),
      updatedAt: campaign.updated_at ? String(campaign.updated_at) : null,
    },
    report: {
      generatedAt: generatedAt.toISOString(),
      lastUpdated,
      totalCalls,
      completed,
      noAnswer,
      failed,
      interested,
      notInterested,
      unknownInterest,
    },
    candidates,
  });

  const slug = safeFilenamePiece(String(campaign.campaign_name ?? "")) || safeFilenamePiece(campaignId);
  const filename = `campaign-report-${slug}-${formatFileTimestamp(generatedAt)}.doc`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

