export type RetellCreatePhoneCallRequest = {
  from_number: string;
  to_number: string;
  override_agent_id: string;
  retell_llm_dynamic_variables?: Record<string, string>;
  agent_override?: {
    retell_llm?: {
      begin_message?: string | null;
      begin_after_user_silence_ms?: number | null;
    };
    webhook_url?: string | null;
    webhook_events?: Array<
      | "call_started"
      | "call_ended"
      | "call_analyzed"
      | "transcript_updated"
      | "transfer_started"
      | "transfer_bridged"
      | "transfer_cancelled"
      | "transfer_ended"
    > | null;
    webhook_timeout_ms?: number | null;
  };
  metadata?: Record<string, unknown>;
};

export type RetellCreatePhoneCallResponse = {
  call_id: string;
  agent_id: string;
  agent_version: number;
  call_status: "registered" | "not_connected" | "ongoing" | "ended" | "error" | string;
  call_type: "phone_call" | string;
  direction: "outbound" | "inbound" | string;
  from_number: string;
  to_number: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function retellCreatePhoneCall(
  input: Omit<RetellCreatePhoneCallRequest, "override_agent_id"> & { override_agent_id?: string },
) {
  const apiKey = requiredEnv("RETELL_API_KEY");
  const overrideAgentId = input.override_agent_id ?? requiredEnv("RETELL_AGENT_ID");

  const body: RetellCreatePhoneCallRequest = {
    from_number: input.from_number,
    to_number: input.to_number,
    override_agent_id: overrideAgentId,
    retell_llm_dynamic_variables: input.retell_llm_dynamic_variables,
    agent_override: input.agent_override,
    metadata: input.metadata,
  };

  // Debug: confirm webhook override routing without leaking secrets.
  try {
    const toLast4 = String(body.to_number ?? "").slice(-4);
    const fromLast4 = String(body.from_number ?? "").slice(-4);
    console.log("[retell] create-phone-call", {
      to_last4: toLast4,
      from_last4: fromLast4,
      override_agent_id: overrideAgentId,
      webhook_url: body.agent_override?.webhook_url ?? null,
      webhook_events: body.agent_override?.webhook_events ?? null,
    });
  } catch {
    // ignore
  }

  const res = await fetch("https://api.retellai.com/v2/create-phone-call", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const payload = safeJsonParse(text);

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message?: unknown }).message ?? `Retell API error (HTTP ${res.status}).`)
        : `Retell API error (HTTP ${res.status}).`;
    throw new Error(message);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Retell API returned an invalid response.");
  }

  const r = payload as Partial<RetellCreatePhoneCallResponse>;
  if (!r.call_id) throw new Error("Retell API response missing call_id.");
  return r as RetellCreatePhoneCallResponse;
}

