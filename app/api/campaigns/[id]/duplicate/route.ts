import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

function nowIso() {
  return new Date().toISOString();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    .select("id,campaign_name,job_title,job_description,required_skills,employment_type")
    .eq("id", sourceCampaignId)
    .maybeSingle();

  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 });
  if (!source?.id) return NextResponse.json({ error: "Source campaign not found." }, { status: 404 });

  // Validate unique name (best-effort; DB constraint may still be the source of truth).
  const { data: existingByName, error: nameError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("campaign_name", newCampaignName)
    .limit(1);
  if (nameError) return NextResponse.json({ error: nameError.message }, { status: 500 });
  if ((existingByName ?? []).length) {
    return NextResponse.json({ error: "Campaign name must be unique." }, { status: 409 });
  }

  const createdAt = nowIso();

  // Campaign rows require non-empty details in the current product. If Step 1 is not copied,
  // we create placeholders so the campaign is editable but clearly incomplete.
  const jobTitle = copyStep1 ? String(source.job_title ?? "").trim() : "TBD";
  const jobDescription = copyStep1 ? String(source.job_description ?? "").trim() : "TBD";
  const requiredSkills = copyStep1 ? String(source.required_skills ?? "").trim() : "TBD";
  const employmentType = copyStep1 ? String(source.employment_type ?? "").trim() : "Full-time";

  let newCampaignId: string | null = null;
  const createdListIds: string[] = [];
  try {
    const { data: createdCampaign, error: createCampaignError } = await supabase
      .from("campaigns")
      .insert({
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
      return NextResponse.json({ error: message }, { status: 500 });
    }

    newCampaignId = String(createdCampaign.id);

    // Step 3 — Call configuration
    if (copyStep3) {
      const { data: sourceCallConfig, error: callConfigError } = await supabase
        .from("call_configurations")
        .select("company_name,selected_questions,custom_questions,call_notes")
        .eq("campaign_id", sourceCampaignId)
        .maybeSingle();

      if (callConfigError) return NextResponse.json({ error: callConfigError.message }, { status: 500 });

      if (sourceCallConfig) {
        const { error: upsertError } = await supabase
          .from("call_configurations")
          .upsert(
            {
              campaign_id: newCampaignId,
              company_name: sourceCallConfig.company_name ? String(sourceCallConfig.company_name) : null,
              selected_questions: Array.isArray(sourceCallConfig.selected_questions) ? sourceCallConfig.selected_questions : [],
              custom_questions: Array.isArray(sourceCallConfig.custom_questions) ? sourceCallConfig.custom_questions : [],
              call_notes: sourceCallConfig.call_notes ? String(sourceCallConfig.call_notes) : null,
              updated_at: createdAt,
            },
            { onConflict: "campaign_id" },
          );

        if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }
    }

    // Step 2 — Candidates (deep copy: duplicate attached lists + candidates into new lists)
    if (copyStep2) {
      const { data: attachedLinks, error: attachedError } = await supabase
        .from("campaign_candidate_lists")
        .select("list_id")
        .eq("campaign_id", sourceCampaignId);
      if (attachedError) return NextResponse.json({ error: attachedError.message }, { status: 500 });

      const sourceListIds = (attachedLinks ?? []).map((r) => String(r.list_id)).filter(Boolean);
      if (sourceListIds.length) {
        const { data: sourceLists, error: sourceListsError } = await supabase
          .from("candidate_lists")
          .select("id,list_name,source_file_name")
          .in("id", sourceListIds);
        if (sourceListsError) return NextResponse.json({ error: sourceListsError.message }, { status: 500 });

        let totalCandidates = 0;
        for (const list of (sourceLists ?? []) as Array<{ id: unknown; list_name: unknown; source_file_name: unknown }>) {
          const sourceListId = String(list.id ?? "");
          if (!sourceListId) continue;
          const listName = String(list.list_name ?? "Candidate list");
          const sourceFileName = String(list.source_file_name ?? "");

          const { data: newList, error: newListError } = await supabase
            .from("candidate_lists")
            .insert({
              list_name: `${listName} (Copy)`,
              source_file_name: sourceFileName,
              total_candidates: 0,
            })
            .select("id")
            .single();
          if (newListError) return NextResponse.json({ error: newListError.message }, { status: 500 });

          const newListId = String(newList.id);
          createdListIds.push(newListId);

          const { data: sourceCandidates, error: sourceCandidatesError } = await supabase
            .from("candidates")
            .select("name,phone,email")
            .eq("list_id", sourceListId)
            .limit(50000);
          if (sourceCandidatesError) return NextResponse.json({ error: sourceCandidatesError.message }, { status: 500 });

          const rows = (sourceCandidates ?? []).map((c) => ({
            list_id: newListId,
            name: String((c as { name?: unknown }).name ?? "").trim(),
            phone: String((c as { phone?: unknown }).phone ?? "").trim(),
            email: String((c as { email?: unknown }).email ?? "").trim(),
          }));

          for (const batch of chunk(rows, 500)) {
            const { error: insertErr } = await supabase.from("candidates").insert(batch);
            if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
          }

          const count = rows.length;
          totalCandidates += count;

          const { error: updateListErr } = await supabase
            .from("candidate_lists")
            .update({ total_candidates: count })
            .eq("id", newListId);
          if (updateListErr) return NextResponse.json({ error: updateListErr.message }, { status: 500 });

          const { error: linkErr } = await supabase
            .from("campaign_candidate_lists")
            .upsert({ campaign_id: newCampaignId, list_id: newListId }, { onConflict: "campaign_id,list_id", ignoreDuplicates: true });
          if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });
        }

        const { error: updateCampaignErr } = await supabase
          .from("campaigns")
          .update({ candidate_count: totalCandidates, updated_at: createdAt })
          .eq("id", newCampaignId);
        if (updateCampaignErr) return NextResponse.json({ error: updateCampaignErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, campaignId: newCampaignId }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Couldn’t duplicate campaign.";
    // Best-effort cleanup.
    if (newCampaignId) {
      await supabase.from("campaigns").delete().eq("id", newCampaignId);
    }
    if (createdListIds.length) {
      await supabase.from("candidate_lists").delete().in("id", createdListIds);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

