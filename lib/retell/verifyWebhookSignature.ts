import crypto from "crypto";

function timingSafeEqualHex(aHex: string, bHex: string) {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyRetellWebhookSignature(opts: {
  rawBody: string;
  signatureHeader: string | null;
  apiKey: string;
  maxSkewMs?: number;
}): { ok: true } | { ok: false; reason: string } {
  const { rawBody, signatureHeader, apiKey, maxSkewMs = 5 * 60 * 1000 } = opts;

  if (!signatureHeader) return { ok: false, reason: "Missing X-Retell-Signature header." };

  const match = signatureHeader.match(/v=(\d+),d=([a-f0-9]+)/i);
  if (!match) return { ok: false, reason: "Invalid X-Retell-Signature format." };

  const timestampStr = match[1] ?? "";
  const digestHex = (match[2] ?? "").toLowerCase();
  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return { ok: false, reason: "Invalid signature timestamp." };
  if (!digestHex.length) return { ok: false, reason: "Invalid signature digest." };

  const now = Date.now();
  const skew = Math.abs(now - timestamp);
  if (skew > maxSkewMs) return { ok: false, reason: "Signature timestamp is too old/new." };

  // Retell spec: HMAC-SHA256(raw_body + timestamp, api_key) => hex digest.
  const computed = crypto.createHmac("sha256", apiKey).update(rawBody + timestampStr).digest("hex");
  const ok = timingSafeEqualHex(computed, digestHex);
  return ok ? { ok: true } : { ok: false, reason: "Invalid signature digest." };
}

