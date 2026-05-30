import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function nowIso() {
  return new Date().toISOString();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function httpError(status: number, message: string): HttpError {
  return new HttpError(status, message);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sourceCampaignId } = await params;

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const newCampaignName = isObject(payload) ? String(payload.newCampaignName ?? "").trim() : "";
  const copyStep1 = isObject(payload) ? Boolean(payload.copyStep1) : false;
  const copyStep2 = isObject(payload) ? Boolean(payload.copyStep2) : false;
  const copyStep3 = isObject(payload) ? Boolean(payload.copyStep3) : false;

  if (!newCampaignName) {
    return NextResponse.json({ error: "New campaign name is required." }, { status: 400 });
  }
  if (!copyStep1 && !copyStep2 && !copyStep3) {
    return NextResponse.json({ error: "Select at least one setup step to copy." }, { status: 400 });
  }

  // Validate source campaign exists.
  const { data: source, error: sourceError } = await supabase
    .from("campaigns")
    .select("id,status,candidate_count,campaign_name,job_title,job_description,required_skills,employment_type")
    .eq("id", sourceCampaignId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 });
  if (!source?.id) return NextResponse.json({ error: "Source campaign not found." }, { status: 404 });

  // Validate unique name (best-effort; DB constraint may still be the source of truth).
  const { data: existingByName, error: nameError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("campaign_name", newCampaignName)
    .eq("user_id", user.id)
    .limit(1);
  if (nameError) return NextResponse.json({ error: nameError.message }, { status: 500 });
  if ((existingByName ?? []).length) {
    return NextResponse.json({ error: "Campaign name must be unique." }, { status: 409 });
  }

  const createdAt = nowIso();

  // Validate selected steps *before* creating anything.
  // If dependencies for a checked step are missing, return a clean 409 with a user-friendly message.
  let sourceCandidateListIds: string[] = [];
  let sourceCandidateLists: Array<{ id: string; totalCandidates: number }> = [];
  let sourceCallSetupTemplateId: string | null = null;

  let missingCandidateListDependency = false;
  let missingTemplateDependency = false;

  const sourceCandidateCount = Number((source as { candidate_count?: unknown } | null)?.candidate_count ?? 0);

  const { data: sourceCallConfigRow, error: sourceCallConfigError } = copyStep3
    ? await supabase
        .from("call_configurations")
        .select("id")
        .eq("campaign_id", sourceCampaignId)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null, error: null };
  if (sourceCallConfigError) return NextResponse.json({ error: sourceCallConfigError.message }, { status: 500 });

  const sourceHasCallConfig = Boolean(sourceCallConfigRow?.id);

  let sourceCandidateLinksCount = 0;
  let validCandidateListsCount = 0;
  let sourceTemplateLinksCount = 0;
  let validTemplatesCount = 0;

  if (copyStep2) {
    const { data: attachedLinks, error: attachedError } = await supabase
      .from("campaign_candidate_lists")
      .select("list_id")
      .eq("campaign_id", sourceCampaignId)
      .eq("user_id", user.id);
    if (attachedError) return NextResponse.json({ error: attachedError.message }, { status: 500 });

    sourceCandidateLinksCount = (attachedLinks ?? []).length;
    sourceCandidateListIds = Array.from(
      new Set((attachedLinks ?? []).map((r) => String(r.list_id ?? "")).filter(Boolean)),
    );

    if (sourceCandidateListIds.length) {
      const { data: lists, error: listsError } = await supabase
        .from("candidate_lists")
        .select("id,total_candidates")
        .eq("user_id", user.id)
        .in("id", sourceCandidateListIds);
      if (listsError) return NextResponse.json({ error: listsError.message }, { status: 500 });

      sourceCandidateLists = (lists ?? []).map((row) => ({
        id: String(row.id ?? ""),
        totalCandidates: Number(row.total_candidates ?? 0),
      }));
      validCandidateListsCount = sourceCandidateLists.length;

      const found = new Set(sourceCandidateLists.map((r) => r.id).filter(Boolean));
      const missing = sourceCandidateListIds.filter((id) => !found.has(id));
      if (missing.length) missingCandidateListDependency = true;
    }

    // If the campaign appears to have Step 2 completed (candidate_count > 0) but it no longer has a valid list attachment,
    // treat this as a missing dependency even if the link rows were removed.
    const sourceStep2Completed = sourceCandidateCount > 0;
    if (sourceStep2Completed) {
      const hasValidList = validCandidateListsCount > 0;
      if (!hasValidList) missingCandidateListDependency = true;
    }
  }

  if (copyStep3) {
    const { data: attachedTemplates, error: attachedTemplateError } = await supabase
      .from("campaign_call_setup_templates")
      .select("call_setup_template_id")
      .eq("campaign_id", sourceCampaignId)
      .eq("user_id", user.id)
      .limit(10);
    if (attachedTemplateError) return NextResponse.json({ error: attachedTemplateError.message }, { status: 500 });

    sourceTemplateLinksCount = (attachedTemplates ?? []).length;
    const attachedTemplateIds = Array.from(
      new Set((attachedTemplates ?? []).map((r) => String((r as { call_setup_template_id?: unknown }).call_setup_template_id ?? "")).filter(Boolean)),
    );
    sourceCallSetupTemplateId = attachedTemplateIds[0] ? String(attachedTemplateIds[0]) : null;

    if (attachedTemplateIds.length) {
      const { data: templateRow, error: templateErr } = await supabase
        .from("call_setup_templates")
        .select("id")
        .eq("user_id", user.id)
        .in("id", attachedTemplateIds);
      if (templateErr) return NextResponse.json({ error: templateErr.message }, { status: 500 });
      const ids = new Set((templateRow ?? []).map((r) => String((r as { id?: unknown }).id ?? "")).filter(Boolean));
      validTemplatesCount = ids.size;
      if (ids.size === 0) missingTemplateDependency = true;
      else {
        const firstValid = attachedTemplateIds.find((id) => ids.has(id));
        sourceCallSetupTemplateId = firstValid ? String(firstValid) : null;
      }
    }

    // If the campaign appears to have Step 3 completed (call_configurations exists) but it no longer has a valid template attachment,
    // treat this as a missing dependency even if the link rows were removed.
    const sourceStep3Completed = sourceHasCallConfig;
    if (sourceStep3Completed) {
      const hasValidTemplate = Boolean(sourceCallSetupTemplateId) && validTemplatesCount > 0;
      if (!hasValidTemplate) missingTemplateDependency = true;
    }
  }

  const decision =
    missingCandidateListDependency || missingTemplateDependency
      ? "fail_409_missing_dependency"
      : "ok_create_duplicate";

  console.log("[duplicate_campaign.validate]", {
    userId: user.id,
    sourceCampaignId,
    copyStep2,
    copyStep3,
    sourceCandidateCount,
    sourceCandidateLinksCount,
    validCandidateListsCount,
    sourceHasCallConfig,
    sourceTemplateLinksCount,
    validTemplatesCount,
    missingCandidateListDependency,
    missingTemplateDependency,
    decision,
  });

  if (missingCandidateListDependency || missingTemplateDependency) {
    if (missingCandidateListDependency && missingTemplateDependency) {
      return NextResponse.json(
        {
          error:
            "The candidate list and call setup template used by this campaign were deleted. Uncheck Step 2 and Step 3, then create the duplicate.",
        },
        { status: 409 },
      );
    }
    if (missingCandidateListDependency) {
      return NextResponse.json(
        {
          error:
            "The candidate list used by this campaign was deleted. Uncheck Step 2 or add candidates again after duplicating.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error:
          "The call setup template used by this campaign was deleted. Uncheck Step 3 or configure calls again after duplicating.",
      },
      { status: 409 },
    );
  }

  // Campaign rows require non-empty details in the current product. If Step 1 is not copied,
  // we create placeholders so the campaign is editable but clearly incomplete.
  const jobTitle = copyStep1 ? String(source.job_title ?? "").trim() : "TBD";
  const jobDescription = copyStep1 ? String(source.job_description ?? "").trim() : "TBD";
  const requiredSkills = copyStep1 ? String(source.required_skills ?? "").trim() : "TBD";
  const employmentType = copyStep1 ? String(source.employment_type ?? "").trim() : "Full-time";

  let newCampaignId: string | null = null;
  try {
    const { data: createdCampaign, error: createCampaignError } = await supabase
      .from("campaigns")
      .insert({
        user_id: user.id,
        campaign_name: newCampaignName,
        job_title: jobTitle,
        job_description: jobDescription,
        required_skills: requiredSkills,
        employment_type: employmentType,
        status: "Draft",
        candidate_count: 0,
        updated_at: createdAt,
      })
      .select("id")
      .single();

    if (createCampaignError) {
      const message = createCampaignError.message.includes("duplicate")
        ? "Campaign name must be unique."
        : createCampaignError.message;
      throw httpError(createCampaignError.message.includes("duplicate") ? 409 : 500, message);
    }

    newCampaignId = String(createdCampaign.id);

    // Step 3 — Call configuration
    if (copyStep3) {
      const { data: sourceCallConfig, error: callConfigError } = await supabase
        .from("call_configurations")
        .select("company_name,selected_questions,custom_questions,call_notes")
        .eq("campaign_id", sourceCampaignId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (callConfigError) throw httpError(500, callConfigError.message);

      if (sourceCallConfig) {
        const { error: upsertError } = await supabase
          .from("call_configurations")
          .upsert(
            {
              campaign_id: newCampaignId,
              user_id: user.id,
              company_name: sourceCallConfig.company_name ? String(sourceCallConfig.company_name) : null,
              selected_questions: Array.isArray(sourceCallConfig.selected_questions) ? sourceCallConfig.selected_questions : [],
              custom_questions: Array.isArray(sourceCallConfig.custom_questions) ? sourceCallConfig.custom_questions : [],
              call_notes: sourceCallConfig.call_notes ? String(sourceCallConfig.call_notes) : null,
              updated_at: createdAt,
            },
            { onConflict: "campaign_id" },
          );

        if (upsertError) throw httpError(500, upsertError.message);
      }

      // Only link a call setup template when we have a verified non-null template id.
      if (sourceCallSetupTemplateId) {
        const linkRow = {
          campaign_id: newCampaignId,
          call_setup_template_id: sourceCallSetupTemplateId,
          user_id: user.id,
          updated_at: createdAt,
        };
        const { error: linkErr } = await supabase
          .from("campaign_call_setup_templates")
          .upsert(linkRow, { onConflict: "campaign_id" });
        if (linkErr) {
          // If the unique constraint isn't present yet, fall back to delete+insert.
          await supabase.from("campaign_call_setup_templates").delete().eq("campaign_id", newCampaignId).eq("user_id", user.id);
          const { error: insertErr } = await supabase.from("campaign_call_setup_templates").insert(linkRow);
          if (insertErr) throw httpError(500, insertErr.message);
        }
      }
    }

    // Step 2 — Candidates (reuse: attach the same existing lists; do not create copies)
    if (copyStep2) {
      if (sourceCandidateListIds.length) {
        const rows = sourceCandidateListIds.map((listId) => ({ campaign_id: newCampaignId, list_id: listId, user_id: user.id }));
        const { error: linkErr } = await supabase
          .from("campaign_candidate_lists")
          .upsert(rows, { onConflict: "campaign_id,list_id", ignoreDuplicates: true });
        if (linkErr) throw httpError(500, linkErr.message);
      }

      const totalCandidates = sourceCandidateLists.reduce((sum, row) => sum + Number(row.totalCandidates ?? 0), 0);
      const { error: updateCampaignErr } = await supabase
        .from("campaigns")
        .update({ candidate_count: totalCandidates, updated_at: createdAt })
        .eq("id", newCampaignId)
        .eq("user_id", user.id);
      if (updateCampaignErr) throw httpError(500, updateCampaignErr.message);
    }

    return NextResponse.json({ ok: true, campaignId: newCampaignId }, { status: 201 });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const rawMessage = e instanceof Error ? e.message : "Couldn’t duplicate campaign.";
    const message = status >= 500 ? "Couldn’t duplicate campaign." : rawMessage;
    // Best-effort cleanup.
    if (newCampaignId) {
      await supabase.from("campaign_call_setup_templates").delete().eq("campaign_id", newCampaignId).eq("user_id", user.id);
      await supabase.from("call_configurations").delete().eq("campaign_id", newCampaignId).eq("user_id", user.id);
      await supabase.from("campaign_candidate_lists").delete().eq("campaign_id", newCampaignId).eq("user_id", user.id);
      await supabase.from("campaigns").delete().eq("id", newCampaignId).eq("user_id", user.id);
    }
    return NextResponse.json({ error: message }, { status });
  }
}

