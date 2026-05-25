function nonEmpty(value: unknown) {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

function joinQuestions(questions: string[]) {
  const clean = questions.map((q) => q.trim()).filter(Boolean);
  if (!clean.length) return null;
  return clean.map((q, idx) => `${idx + 1}. ${q}`).join("\n");
}

export function buildRecruiterDynamicVariables(input: {
  campaignName: string | null;
  jobTitle: string | null;
  jobDescription: string | null;
  employmentType: string | null;
  requiredSkills: string | null;
  companyName: string | null;
  selectedQuestions: string[];
  customQuestions: string[];
  callNotes: string | null;
  candidateName: string | null;
}) {
  const screeningQuestions = joinQuestions([...input.selectedQuestions, ...input.customQuestions]);

  // Retell dynamic variables must be string values only.
  const vars: Record<string, string> = {};

  const fields: Array<[string, string | null]> = [
    ["campaign_name", nonEmpty(input.campaignName)],
    ["job_title", nonEmpty(input.jobTitle)],
    ["job_description", nonEmpty(input.jobDescription)],
    ["employment_type", nonEmpty(input.employmentType)],
    ["required_skills", nonEmpty(input.requiredSkills)],
    ["company_name", nonEmpty(input.companyName)],
    ["screening_questions", screeningQuestions],
    ["call_notes", nonEmpty(input.callNotes)],
    ["candidate_name", nonEmpty(input.candidateName)],
  ];

  for (const [key, value] of fields) {
    if (value) vars[key] = value;
  }

  // Some agents prefer a single consolidated block they can read verbatim.
  const contextLines: string[] = [];
  if (vars.campaign_name) contextLines.push(`Campaign: ${vars.campaign_name}`);
  if (vars.company_name) contextLines.push(`Company: ${vars.company_name}`);
  if (vars.job_title) contextLines.push(`Job title: ${vars.job_title}`);
  if (vars.employment_type) contextLines.push(`Employment type: ${vars.employment_type}`);
  if (vars.required_skills) contextLines.push(`Required skills: ${vars.required_skills}`);
  if (vars.job_description) contextLines.push(`Job description:\n${vars.job_description}`);
  if (vars.screening_questions) contextLines.push(`Screening questions:\n${vars.screening_questions}`);
  if (vars.call_notes) contextLines.push(`Call notes:\n${vars.call_notes}`);
  if (vars.candidate_name) contextLines.push(`Candidate name: ${vars.candidate_name}`);

  if (contextLines.length) {
    vars.context_block = contextLines.join("\n\n");
  }

  return vars;
}

