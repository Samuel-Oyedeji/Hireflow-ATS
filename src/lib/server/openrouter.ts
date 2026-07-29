import { z } from "zod";

import type {
  AiDecision,
  Confidence,
  CriteriaUpdate,
  CriterionMatch,
  CriterionResult,
  TranscriptSuggestion,
} from "../types";
import { serverEnv } from "./env";

/** Minimal role shape the prompts need. */
export interface RoleForAI {
  title: string;
  department: string;
  criteria: { id: string; label: string; detail: string; weight: string }[];
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_TEXT = 24000; // keep prompts bounded

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

/**
 * Call OpenRouter (OpenAI-compatible) expecting a single JSON object, validate it
 * against `schema`, and retry once on a parse/validation miss. Throws a typed error
 * on transport failure or if the model can't produce valid JSON after the retry.
 */
async function chatJSON<T>(args: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${serverEnv.openRouterApiKey}`,
    "Content-Type": "application/json",
    "X-Title": serverEnv.openRouterAppTitle,
  };
  if (serverEnv.openRouterAppUrl) headers["HTTP-Referer"] = serverEnv.openRouterAppUrl;

  const body = JSON.stringify({
    model: serverEnv.openRouterModel,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(OPENROUTER_URL, { method: "POST", headers, body });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenRouter request failed (${res.status}): ${text.slice(0, 500)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      lastErr = new Error("OpenRouter response had no text content");
      continue;
    }
    try {
      return args.schema.parse(JSON.parse(stripCodeFences(content)));
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`OpenRouter returned invalid JSON after retry: ${String(lastErr)}`);
}

/* ---------------- Resume screening ---------------- */

const screeningSchema = z.object({
  aiScore: z.number(),
  aiDecision: z.enum(["advanced", "rejected"]),
  reasoning: z.string(),
  education: z.array(z.string()).nullish(),
  workHistory: z.array(z.string()).nullish(),
  criteriaResults: z.array(
    z.object({
      criterionId: z.string(),
      match: z.enum(["met", "not-met", "partial"]),
      note: z.string(),
    }),
  ),
});

export interface ScreeningResult {
  aiScore: number;
  aiDecision: AiDecision;
  reasoning: string;
  education: string[];
  workHistory: string[];
  criteriaResults: CriterionResult[];
}

/** Ensure every role criterion has exactly one result and the score is in range. */
function normalizeScreening(
  parsed: z.infer<typeof screeningSchema>,
  role: RoleForAI,
): ScreeningResult {
  const byId = new Map(parsed.criteriaResults.map((r) => [r.criterionId, r]));
  const criteriaResults: CriterionResult[] = role.criteria.map((c) => {
    const hit = byId.get(c.id);
    return hit
      ? { criterionId: c.id, match: hit.match as CriterionMatch, note: hit.note }
      : {
          criterionId: c.id,
          match: "not-met",
          note: "Not addressed in the submitted documents.",
        };
  });
  const aiScore = Math.max(0, Math.min(100, Math.round(parsed.aiScore)));
  return {
    aiScore,
    aiDecision: parsed.aiDecision,
    reasoning: parsed.reasoning,
    education: parsed.education ?? [],
    workHistory: parsed.workHistory ?? [],
    criteriaResults,
  };
}

export async function screenResume(args: {
  role: RoleForAI;
  documentsText: string;
}): Promise<ScreeningResult> {
  const { role, documentsText } = args;
  const criteriaList = role.criteria
    .map((c) => `- id: ${c.id}\n  label: ${c.label}\n  detail: ${c.detail}\n  importance: ${c.weight}`)
    .join("\n");

  const system =
    "You are an impartial hiring screener for a healthcare clinic. Assess a candidate's " +
    "application documents strictly against the role's stated criteria. Judge only job-relevant " +
    "evidence; never consider personal background, protected characteristics, or anything not tied " +
    "to a stated criterion. Respond with a single JSON object only, no prose.";

  const user = `ROLE: ${role.title} — ${role.department}
CRITERIA:
${criteriaList}

CANDIDATE DOCUMENTS (resume / cover letter text):
"""
${documentsText.slice(0, MAX_TEXT)}
"""

Return JSON exactly in this shape:
{
  "aiScore": <integer 0-100 overall fit against the criteria>,
  "aiDecision": "advanced" | "rejected",
  "reasoning": "<2-4 sentences citing the criteria and the evidence>",
  "education": ["<one concise line per qualification, e.g. 'BSc Nursing — University of Lagos (2018–2022)'>"],
  "workHistory": ["<one concise line per role, e.g. 'Staff Nurse — Riverside Clinic (2022–present): triage, med administration'>"],
  "criteriaResults": [
    { "criterionId": "<one of the ids above>", "match": "met" | "not-met" | "partial", "note": "<short evidence from the documents>" }
  ]
}
Rules:
- Include exactly ONE entry in criteriaResults for EACH criterion id listed above.
- If the documents contain no relevant evidence for a criterion, mark it "not-met".
- "advanced" only when there is a strong overall match, especially on "required" criteria.
- "education": list the candidate's qualifications found in the documents, most recent first; [] if none stated.
- "workHistory": list the candidate's roles found in the documents, most recent first; [] if none stated.
- For education and workHistory, extract only what the documents actually state — never invent details.`;

  const parsed = await chatJSON({ system, user, schema: screeningSchema });
  return normalizeScreening(parsed, role);
}

/* ---------------- Transcript analysis ---------------- */

const analysisSchema = z.object({
  overallSuggestion: z.enum(["hire", "reject", "further_review"]),
  confidence: z.enum(["high", "medium", "low"]),
  summary: z.string(),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  criteriaUpdate: z.array(
    z.object({
      criterionId: z.string(),
      originalAssessment: z.enum(["met", "not_met", "unclear"]),
      updatedAssessment: z.enum(["met", "not_met", "unclear"]),
      note: z.string(),
    }),
  ),
  suggestedNextStep: z.string(),
  errorFlag: z.boolean(),
  errorReason: z.string().nullish(),
});

export interface AnalysisResult {
  overallSuggestion: TranscriptSuggestion;
  confidence: Confidence;
  summary: string;
  strengths: string[];
  concerns: string[];
  criteriaUpdate: CriteriaUpdate[];
  suggestedNextStep: string;
  errorFlag: boolean;
  errorReason?: string;
}

export async function analyzeTranscriptText(args: {
  role: RoleForAI;
  screening: { aiScore: number; aiDecision: AiDecision; reasoning: string };
  transcriptText: string;
}): Promise<AnalysisResult> {
  const { role, screening, transcriptText } = args;
  const criteriaList = role.criteria
    .map((c) => `- id: ${c.id}\n  label: ${c.label}\n  detail: ${c.detail}\n  importance: ${c.weight}`)
    .join("\n");

  const system =
    "You are an impartial interview assessor for a healthcare clinic. You are given an interview " +
    "transcript, the role's criteria, and the candidate's earlier resume-screening result. Base your " +
    "hiring suggestion on the INTERVIEW CONTENT against the criteria — the screening result is context, " +
    "not the primary input. Flag any criterion that was unclear from the resume but became clearer (in " +
    "either direction) during the interview. Never factor in personal background, protected " +
    "characteristics, or anything not tied to a stated criterion. If the transcript is too short, " +
    "incoherent, or clearly not an interview, set errorFlag true with an errorReason instead of guessing. " +
    "Respond with a single JSON object only, no prose.";

  const user = `ROLE: ${role.title} — ${role.department}
CRITERIA:
${criteriaList}

EARLIER RESUME SCREENING (context only):
- score: ${screening.aiScore}
- decision: ${screening.aiDecision}
- reasoning: ${screening.reasoning}

INTERVIEW TRANSCRIPT:
"""
${transcriptText.slice(0, MAX_TEXT)}
"""

Return JSON exactly in this shape:
{
  "overallSuggestion": "hire" | "reject" | "further_review",
  "confidence": "high" | "medium" | "low",
  "summary": "<2-3 sentence plain-language summary of interview performance>",
  "strengths": ["<string>", "..."],
  "concerns": ["<string>", "..."],
  "criteriaUpdate": [
    { "criterionId": "<one of the ids above>", "originalAssessment": "met" | "not_met" | "unclear", "updatedAssessment": "met" | "not_met" | "unclear", "note": "<what the interview revealed about this criterion>" }
  ],
  "suggestedNextStep": "<plain language, e.g. 'Proceed to offer' or 'Request a second interview to probe X'>",
  "errorFlag": false,
  "errorReason": null
}
If errorFlag is true, the other fields may be empty/default.`;

  const parsed = await chatJSON({ system, user, schema: analysisSchema });
  return {
    overallSuggestion: parsed.overallSuggestion,
    confidence: parsed.confidence,
    summary: parsed.summary,
    strengths: parsed.strengths,
    concerns: parsed.concerns,
    criteriaUpdate: parsed.criteriaUpdate.map((u) => ({
      criterionId: u.criterionId,
      originalAssessment: u.originalAssessment,
      updatedAssessment: u.updatedAssessment,
      note: u.note,
    })),
    suggestedNextStep: parsed.suggestedNextStep,
    errorFlag: parsed.errorFlag,
    errorReason: parsed.errorReason ?? undefined,
  };
}
