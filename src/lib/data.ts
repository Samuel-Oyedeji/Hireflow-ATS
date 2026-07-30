import { createServerFn } from "@tanstack/react-start";

import type {
  Applicant,
  ApplicantDocument,
  ApplicantSource,
  AppState,
  BulkImport,
  CriterionWeight,
  EmailTemplate,
  FinalDecision,
  HumanDecision,
  Role,
  RoleStatus,
  TranscriptAnalysis,
  TranscriptSuggestion,
  TranscriptUpload,
} from "./types";
import { getSupabase, signedUrl, uploadToBucket } from "./server/supabase";
import {
  analyzeTranscriptText,
  screenResume,
  type RoleForAI,
  type ScreeningResult,
} from "./server/openrouter";

/* ---------------- input types (shared with the client store) ---------------- */

export interface DocInput {
  name: string;
  type: ApplicantDocument["type"];
  fileName: string;
  storagePath?: string;
  text?: string;
}
export interface AddApplicantInput {
  name: string;
  email: string;
  phone?: string;
  roleId: string;
  documents: DocInput[];
  source?: ApplicantSource;
  notes?: string;
  bulkImportId?: string;
}
export interface CriterionInput {
  id?: string;
  label: string;
  detail: string;
  weight: CriterionWeight;
}
export interface UpsertRoleInput {
  id?: string;
  title: string;
  department: string;
  status: RoleStatus;
  criteria: CriterionInput[];
}
export interface UpsertTemplateInput {
  id?: string;
  name: string;
  usedFor: string;
  subject: string;
  body: string;
}
export interface CreateBulkImportInput {
  roleId: string;
  importedBy: string;
  fileName: string;
  totalFiles: number;
  successful: number;
  failed: number;
  skipped: number;
}
export interface AnalyzeTranscriptInput {
  applicantId: string;
  fileName: string;
  storagePath?: string;
  text?: string;
  uploadedBy: string;
}

/* ---------------- db helpers ---------------- */

type SupabaseResult<T> = { data: T | null; error: { message: string } | null };
function unwrap<T>(res: SupabaseResult<T>): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/* Row shapes (untyped Supabase rows narrowed to what we read). */
interface RoleRow {
  id: string;
  title: string;
  department: string;
  status: RoleStatus;
  created_date: string;
}
interface CriterionRow {
  id: string;
  role_id: string;
  label: string;
  detail: string;
  weight: CriterionWeight;
  sort_order: number;
}
interface ApplicantRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role_id: string;
  source: ApplicantSource;
  notes: string | null;
  bulk_import_id: string | null;
  submitted_date: string;
  ai_score: number;
  ai_decision: "advanced" | "rejected";
  reasoning: string;
  education: string[] | null;
  work_history: string[] | null;
  human_decision: "advance" | "reject" | null;
  override_reason: string | null;
  decided_by: string | null;
  decided_date: string | null;
  invited: boolean;
  invited_date: string | null;
}
interface DocRow {
  id: string;
  applicant_id: string;
  name: string;
  type: ApplicantDocument["type"];
  file_name: string;
  storage_path: string | null;
  extracted_text: string | null;
}
interface ResultRow {
  applicant_id: string;
  criterion_id: string;
  match: "met" | "not-met" | "partial";
  note: string;
}
interface TranscriptRow {
  id: string;
  applicant_id: string;
  file_name: string;
  uploaded_at: string;
  uploaded_by: string;
}
interface AnalysisRow {
  id: string;
  applicant_id: string;
  transcript_upload_id: string;
  overall_suggestion: TranscriptSuggestion;
  confidence: "high" | "medium" | "low";
  summary: string;
  strengths: string[];
  concerns: string[];
  criteria_update: TranscriptAnalysis["criteriaUpdate"];
  suggested_next_step: string;
  created_at: string;
  error_flag: boolean;
  error_reason: string | null;
}
interface FinalRow {
  id: string;
  applicant_id: string;
  transcript_analysis_id: string | null;
  decision: TranscriptSuggestion;
  is_override: boolean;
  override_reason: string | null;
  decided_by: string;
  created_at: string;
}
interface TemplateRow {
  id: string;
  name: string;
  used_for: string;
  subject: string;
  body: string;
  last_edited: string;
}
interface BulkImportRow {
  id: string;
  role_id: string;
  imported_by: string;
  file_name: string;
  total_files: number;
  successful: number;
  failed: number;
  skipped: number;
  created_at: string;
}

/* ---------------- row -> domain mappers ---------------- */

function mapRole(row: RoleRow, criteria: CriterionRow[]): Role {
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    status: row.status,
    createdDate: row.created_date,
    criteria: criteria
      .filter((c) => c.role_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ id: c.id, label: c.label, detail: c.detail, weight: c.weight })),
  };
}

function mapTranscript(row: TranscriptRow): TranscriptUpload {
  return {
    id: row.id,
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
    uploadedBy: row.uploaded_by,
  };
}

function mapAnalysis(row: AnalysisRow): TranscriptAnalysis {
  return {
    id: row.id,
    transcriptUploadId: row.transcript_upload_id,
    overallSuggestion: row.overall_suggestion,
    confidence: row.confidence,
    summary: row.summary,
    strengths: row.strengths ?? [],
    concerns: row.concerns ?? [],
    criteriaUpdate: row.criteria_update ?? [],
    suggestedNextStep: row.suggested_next_step,
    createdAt: row.created_at,
    errorFlag: row.error_flag,
    errorReason: row.error_reason ?? undefined,
  };
}

function mapFinal(row: FinalRow): FinalDecision {
  return {
    id: row.id,
    transcriptAnalysisId: row.transcript_analysis_id ?? undefined,
    decision: row.decision,
    isOverride: row.is_override,
    overrideReason: row.override_reason ?? undefined,
    decidedBy: row.decided_by,
    createdAt: row.created_at,
  };
}

function mapTemplate(row: TemplateRow): EmailTemplate {
  return {
    id: row.id,
    name: row.name,
    usedFor: row.used_for,
    subject: row.subject,
    body: row.body,
    lastEdited: row.last_edited,
  };
}

function mapBulkImport(row: BulkImportRow): BulkImport {
  return {
    id: row.id,
    roleId: row.role_id,
    importedBy: row.imported_by,
    fileName: row.file_name,
    totalFiles: row.total_files,
    successful: row.successful,
    failed: row.failed,
    skipped: row.skipped,
    createdAt: row.created_at,
  };
}

function assembleApplicant(
  row: ApplicantRow,
  docs: DocRow[],
  results: ResultRow[],
  transcript?: TranscriptRow,
  analysis?: AnalysisRow,
  final?: FinalRow,
): Applicant {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    roleId: row.role_id,
    source: row.source,
    notes: row.notes ?? undefined,
    bulkImportId: row.bulk_import_id ?? undefined,
    submittedDate: row.submitted_date,
    aiScore: row.ai_score,
    aiDecision: row.ai_decision,
    reasoning: row.reasoning,
    education: row.education ?? [],
    workHistory: row.work_history ?? [],
    criteriaResults: results
      .filter((r) => r.applicant_id === row.id)
      .map((r) => ({ criterionId: r.criterion_id, match: r.match, note: r.note })),
    documents: docs
      .filter((d) => d.applicant_id === row.id)
      .map((d) => ({
        name: d.name,
        type: d.type,
        fileName: d.file_name,
        storagePath: d.storage_path ?? undefined,
      })),
    humanDecision: (row.human_decision ?? null) as HumanDecision,
    overrideReason: row.override_reason ?? undefined,
    decidedBy: row.decided_by ?? undefined,
    decidedDate: row.decided_date ?? undefined,
    invited: row.invited,
    invitedDate: row.invited_date ?? undefined,
    transcript: transcript ? mapTranscript(transcript) : undefined,
    transcriptAnalysis: analysis ? mapAnalysis(analysis) : undefined,
    finalDecision: final ? mapFinal(final) : undefined,
  };
}

/** Re-read a single applicant with all of its children (latest transcript/analysis/decision). */
async function loadApplicant(id: string): Promise<Applicant> {
  const sb = getSupabase();
  const [app, docs, results, tr, an, fd] = await Promise.all([
    sb.from("applicants").select("*").eq("id", id).single(),
    sb.from("applicant_documents").select("*").eq("applicant_id", id).order("created_at"),
    sb.from("criteria_results").select("*").eq("applicant_id", id),
    sb
      .from("transcript_uploads")
      .select("*")
      .eq("applicant_id", id)
      .order("uploaded_at", { ascending: false })
      .limit(1),
    sb
      .from("transcript_analyses")
      .select("*")
      .eq("applicant_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
    sb
      .from("final_decisions")
      .select("*")
      .eq("applicant_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  return assembleApplicant(
    unwrap<ApplicantRow>(app),
    unwrap<DocRow[]>(docs) ?? [],
    unwrap<ResultRow[]>(results) ?? [],
    (unwrap<TranscriptRow[]>(tr) ?? [])[0],
    (unwrap<AnalysisRow[]>(an) ?? [])[0],
    (unwrap<FinalRow[]>(fd) ?? [])[0],
  );
}

function toRoleForAI(role: Role): RoleForAI {
  return {
    title: role.title,
    department: role.department,
    criteria: role.criteria.map((c) => ({
      id: c.id,
      label: c.label,
      detail: c.detail,
      weight: c.weight,
    })),
  };
}

async function loadRole(roleId: string): Promise<Role> {
  const sb = getSupabase();
  const [roleRes, critRes] = await Promise.all([
    sb.from("roles").select("*").eq("id", roleId).single(),
    sb.from("criteria").select("*").eq("role_id", roleId),
  ]);
  return mapRole(unwrap<RoleRow>(roleRes), unwrap<CriterionRow[]>(critRes) ?? []);
}

function defaultScreening(role: Role): ScreeningResult {
  return {
    aiScore: 0,
    aiDecision: "rejected",
    reasoning: "No document text was available to screen this applicant. Add documents to run screening.",
    education: [],
    workHistory: [],
    criteriaResults: role.criteria.map((c) => ({
      criterionId: c.id,
      match: "not-met",
      note: "No documents to assess.",
    })),
  };
}

/**
 * Shared create-and-screen path used by both HR upload and the public apply form.
 * Screens the combined document text via OpenRouter (or a neutral default when no
 * text is available), then persists the applicant, its documents and criteria results.
 */
async function createApplicant(input: AddApplicantInput): Promise<string> {
  const sb = getSupabase();
  const role = await loadRole(input.roleId);

  const documentsText = input.documents
    .map((d) => d.text?.trim())
    .filter((t): t is string => !!t)
    .join("\n\n");
  const screening = documentsText
    ? await screenResume({ role: toRoleForAI(role), documentsText })
    : defaultScreening(role);

  const applicant = unwrap<ApplicantRow>(
    await sb
      .from("applicants")
      .insert({
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        role_id: input.roleId,
        source: input.source ?? "manual_upload",
        notes: input.notes ?? null,
        bulk_import_id: input.bulkImportId ?? null,
        ai_score: screening.aiScore,
        ai_decision: screening.aiDecision,
        reasoning: screening.reasoning,
        education: screening.education,
        work_history: screening.workHistory,
      })
      .select("*")
      .single(),
  );

  if (input.documents.length > 0) {
    unwrap(
      await sb.from("applicant_documents").insert(
        input.documents.map((d) => ({
          applicant_id: applicant.id,
          name: d.name,
          type: d.type,
          file_name: d.fileName,
          storage_path: d.storagePath ?? null,
          extracted_text: d.text ?? null,
        })),
      ).select("id"),
    );
  }
  await writeCriteriaResults(applicant.id, screening);
  return applicant.id;
}

async function writeCriteriaResults(applicantId: string, screening: ScreeningResult) {
  const sb = getSupabase();
  if (screening.criteriaResults.length === 0) return;
  unwrap(
    await sb.from("criteria_results").insert(
      screening.criteriaResults.map((r) => ({
        applicant_id: applicantId,
        criterion_id: r.criterionId,
        match: r.match,
        note: r.note,
      })),
    ).select("id"),
  );
}

/* ---------------- server functions ---------------- */

export const getAppState = createServerFn({ method: "GET" }).handler(async (): Promise<AppState> => {
  const sb = getSupabase();
  const [
    settings,
    roles,
    criteria,
    applicants,
    docs,
    results,
    transcripts,
    analyses,
    finals,
    templates,
    bulkImports,
  ] = await Promise.all([
    sb.from("settings").select("*").limit(1).maybeSingle(),
    sb.from("roles").select("*").order("created_date", { ascending: false }),
    sb.from("criteria").select("*"),
    sb.from("applicants").select("*").order("submitted_date", { ascending: false }),
    sb.from("applicant_documents").select("*").order("created_at"),
    sb.from("criteria_results").select("*"),
    sb.from("transcript_uploads").select("*").order("uploaded_at", { ascending: false }),
    sb.from("transcript_analyses").select("*").order("created_at", { ascending: false }),
    sb.from("final_decisions").select("*").order("created_at", { ascending: false }),
    sb.from("email_templates").select("*").order("last_edited", { ascending: false }),
    sb.from("bulk_imports").select("*").order("created_at", { ascending: false }),
  ]);

  const settingsRow = unwrap<{ current_user_name: string; clinic_name: string } | null>(settings);
  const roleRows = unwrap<RoleRow[]>(roles) ?? [];
  const critRows = unwrap<CriterionRow[]>(criteria) ?? [];
  const applicantRows = unwrap<ApplicantRow[]>(applicants) ?? [];
  const docRows = unwrap<DocRow[]>(docs) ?? [];
  const resultRows = unwrap<ResultRow[]>(results) ?? [];
  const transcriptRows = unwrap<TranscriptRow[]>(transcripts) ?? [];
  const analysisRows = unwrap<AnalysisRow[]>(analyses) ?? [];
  const finalRows = unwrap<FinalRow[]>(finals) ?? [];

  // Rows are ordered newest-first, so the first match per applicant is the latest.
  const latest = <T extends { applicant_id: string }>(rows: T[]) => {
    const byApplicant = new Map<string, T>();
    for (const r of rows) if (!byApplicant.has(r.applicant_id)) byApplicant.set(r.applicant_id, r);
    return byApplicant;
  };
  const latestTranscript = latest(transcriptRows);
  const latestAnalysis = latest(analysisRows);
  const latestFinal = latest(finalRows);

  return {
    currentUser: settingsRow?.current_user_name ?? "Jordan Avery",
    clinicName: settingsRow?.clinic_name ?? "Riverside Clinic Group",
    roles: roleRows.map((r) => mapRole(r, critRows)),
    applicants: applicantRows.map((a) =>
      assembleApplicant(
        a,
        docRows,
        resultRows,
        latestTranscript.get(a.id),
        latestAnalysis.get(a.id),
        latestFinal.get(a.id),
      ),
    ),
    templates: (unwrap<TemplateRow[]>(templates) ?? []).map(mapTemplate),
    bulkImports: (unwrap<BulkImportRow[]>(bulkImports) ?? []).map(mapBulkImport),
  };
});

export const uploadFileFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }) => {
    const file = data.get("file");
    const folder = String(data.get("folder") ?? "misc").replace(/[^\w-]+/g, "");
    if (!(file instanceof File)) throw new Error("No file provided.");
    const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-120);
    const path = `${folder || "misc"}/${crypto.randomUUID()}-${safe}`;
    await uploadToBucket(file, path);
    return { fileName: file.name, storagePath: path };
  });

/**
 * Time-limited URL for a stored document. The bucket is private, so the client
 * can't build these itself. Pass `downloadName` to force a download; omit it for
 * an inline URL suitable for iframe preview.
 */
export const documentUrlFn = createServerFn({ method: "POST" })
  .validator((input: { storagePath: string; downloadName?: string }) => input)
  .handler(async ({ data }) => ({
    url: await signedUrl(data.storagePath, 3600, data.downloadName),
  }));

export const addApplicantFn = createServerFn({ method: "POST" })
  .validator((input: AddApplicantInput) => input)
  .handler(async ({ data }) => loadApplicant(await createApplicant(data)));

export const addDocumentsFn = createServerFn({ method: "POST" })
  .validator((input: { applicantId: string; documents: DocInput[] }) => input)
  .handler(async ({ data }) => {
    const sb = getSupabase();
    const appRow = unwrap<ApplicantRow>(
      await sb.from("applicants").select("*").eq("id", data.applicantId).single(),
    );
    const role = await loadRole(appRow.role_id);

    if (data.documents.length > 0) {
      unwrap(
        await sb.from("applicant_documents").insert(
          data.documents.map((d) => ({
            applicant_id: data.applicantId,
            name: d.name,
            type: d.type,
            file_name: d.fileName,
            storage_path: d.storagePath ?? null,
            extracted_text: d.text ?? null,
          })),
        ).select("id"),
      );
    }

    // Re-screen against ALL documents on file (existing + new).
    const allDocs = unwrap<DocRow[]>(
      await sb
        .from("applicant_documents")
        .select("*")
        .eq("applicant_id", data.applicantId),
    ) ?? [];
    const documentsText = allDocs
      .map((d) => d.extracted_text?.trim())
      .filter((t): t is string => !!t)
      .join("\n\n");
    const screening = documentsText
      ? await screenResume({ role: toRoleForAI(role), documentsText })
      : defaultScreening(role);

    unwrap(
      await sb
        .from("applicants")
        .update({
          ai_score: screening.aiScore,
          ai_decision: screening.aiDecision,
          reasoning: screening.reasoning,
          education: screening.education,
          work_history: screening.workHistory,
        })
        .eq("id", data.applicantId)
        .select("id"),
    );
    unwrap(await sb.from("criteria_results").delete().eq("applicant_id", data.applicantId).select("id"));
    await writeCriteriaResults(data.applicantId, screening);
    return loadApplicant(data.applicantId);
  });

export const createBulkImportFn = createServerFn({ method: "POST" })
  .validator((input: CreateBulkImportInput) => input)
  .handler(async ({ data }) => {
    const row = unwrap<BulkImportRow>(
      await getSupabase()
        .from("bulk_imports")
        .insert({
          role_id: data.roleId,
          imported_by: data.importedBy,
          file_name: data.fileName,
          total_files: data.totalFiles,
          successful: data.successful,
          failed: data.failed,
          skipped: data.skipped,
        })
        .select("*")
        .single(),
    );
    return mapBulkImport(row);
  });

export const analyzeTranscriptFn = createServerFn({ method: "POST" })
  .validator((input: AnalyzeTranscriptInput) => input)
  .handler(async ({ data }) => {
    const sb = getSupabase();
    const appRow = unwrap<ApplicantRow>(
      await sb.from("applicants").select("*").eq("id", data.applicantId).single(),
    );
    const role = await loadRole(appRow.role_id);

    const transcript = unwrap<TranscriptRow>(
      await sb
        .from("transcript_uploads")
        .insert({
          applicant_id: data.applicantId,
          file_name: data.fileName,
          storage_path: data.storagePath ?? null,
          extracted_text: data.text ?? null,
          uploaded_by: data.uploadedBy,
        })
        .select("*")
        .single(),
    );

    const text = data.text?.trim() ?? "";
    const analysis = text
      ? await analyzeTranscriptText({
          role: toRoleForAI(role),
          screening: {
            aiScore: appRow.ai_score,
            aiDecision: appRow.ai_decision,
            reasoning: appRow.reasoning,
          },
          transcriptText: text,
        })
      : null;

    unwrap(
      await sb
        .from("transcript_analyses")
        .insert(
          analysis
            ? {
                applicant_id: data.applicantId,
                transcript_upload_id: transcript.id,
                overall_suggestion: analysis.overallSuggestion,
                confidence: analysis.confidence,
                summary: analysis.summary,
                strengths: analysis.strengths,
                concerns: analysis.concerns,
                criteria_update: analysis.criteriaUpdate,
                suggested_next_step: analysis.suggestedNextStep,
                error_flag: analysis.errorFlag,
                error_reason: analysis.errorReason ?? null,
              }
            : {
                applicant_id: data.applicantId,
                transcript_upload_id: transcript.id,
                overall_suggestion: "further_review",
                confidence: "low",
                summary: "",
                strengths: [],
                concerns: [],
                criteria_update: [],
                suggested_next_step: "",
                error_flag: true,
                error_reason:
                  "No readable text could be extracted from this transcript. Please upload the full transcript as PDF, DOCX, or TXT.",
              },
        )
        .select("id"),
    );
    return loadApplicant(data.applicantId);
  });

export const saveDecisionFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      applicantId: string;
      decision: HumanDecision;
      overrideReason: string;
      decidedBy: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    unwrap(
      await getSupabase()
        .from("applicants")
        .update({
          human_decision: data.decision,
          override_reason: data.overrideReason || null,
          decided_by: data.decidedBy,
          decided_date: new Date().toISOString(),
        })
        .eq("id", data.applicantId)
        .select("id"),
    );
    return loadApplicant(data.applicantId);
  });

export const clearDecisionFn = createServerFn({ method: "POST" })
  .validator((input: { applicantId: string }) => input)
  .handler(async ({ data }) => {
    unwrap(
      await getSupabase()
        .from("applicants")
        .update({
          human_decision: null,
          override_reason: null,
          decided_by: null,
          decided_date: null,
        })
        .eq("id", data.applicantId)
        .select("id"),
    );
    return loadApplicant(data.applicantId);
  });

export const saveFinalDecisionFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      applicantId: string;
      decision: TranscriptSuggestion;
      overrideReason: string;
      decidedBy: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const sb = getSupabase();
    const analysis = (unwrap<AnalysisRow[]>(
      await sb
        .from("transcript_analyses")
        .select("*")
        .eq("applicant_id", data.applicantId)
        .order("created_at", { ascending: false })
        .limit(1),
    ) ?? [])[0];
    const suggestion = analysis?.overall_suggestion;
    const isOverride = suggestion !== undefined && data.decision !== suggestion;
    unwrap(
      await sb
        .from("final_decisions")
        .insert({
          applicant_id: data.applicantId,
          transcript_analysis_id: analysis?.id ?? null,
          decision: data.decision,
          is_override: isOverride,
          override_reason: isOverride && data.overrideReason ? data.overrideReason : null,
          decided_by: data.decidedBy,
        })
        .select("id"),
    );
    return loadApplicant(data.applicantId);
  });

export const sendInvitesFn = createServerFn({ method: "POST" })
  .validator((input: { applicantIds: string[] }) => input)
  .handler(async ({ data }) => {
    const invitedDate = new Date().toISOString();
    unwrap(
      await getSupabase()
        .from("applicants")
        .update({ invited: true, invited_date: invitedDate })
        .in("id", data.applicantIds)
        .select("id"),
    );
    return { applicantIds: data.applicantIds, invitedDate };
  });

export const upsertRoleFn = createServerFn({ method: "POST" })
  .validator((input: UpsertRoleInput) => input)
  .handler(async ({ data }): Promise<Role> => {
    const sb = getSupabase();
    let roleId = data.id;

    if (roleId) {
      unwrap(
        await sb
          .from("roles")
          .update({ title: data.title, department: data.department, status: data.status })
          .eq("id", roleId)
          .select("id"),
      );
      const existing = unwrap<{ id: string }[]>(
        await sb.from("criteria").select("id").eq("role_id", roleId),
      ) ?? [];
      const existingIds = new Set(existing.map((c) => c.id));
      const keptIds = new Set(data.criteria.map((c) => c.id).filter(Boolean) as string[]);

      // Delete criteria removed in the editor (cascades their criteria_results).
      const removed = [...existingIds].filter((id) => !keptIds.has(id));
      if (removed.length > 0) {
        unwrap(await sb.from("criteria").delete().in("id", removed).select("id"));
      }
      // Update existing, insert new — preserving order.
      for (let i = 0; i < data.criteria.length; i++) {
        const c = data.criteria[i];
        if (c.id && existingIds.has(c.id)) {
          unwrap(
            await sb
              .from("criteria")
              .update({ label: c.label, detail: c.detail, weight: c.weight, sort_order: i })
              .eq("id", c.id)
              .select("id"),
          );
        } else {
          unwrap(
            await sb
              .from("criteria")
              .insert({
                role_id: roleId,
                label: c.label,
                detail: c.detail,
                weight: c.weight,
                sort_order: i,
              })
              .select("id"),
          );
        }
      }
    } else {
      const role = unwrap<RoleRow>(
        await sb
          .from("roles")
          .insert({ title: data.title, department: data.department, status: data.status })
          .select("*")
          .single(),
      );
      roleId = role.id;
      if (data.criteria.length > 0) {
        unwrap(
          await sb.from("criteria").insert(
            data.criteria.map((c, i) => ({
              role_id: roleId,
              label: c.label,
              detail: c.detail,
              weight: c.weight,
              sort_order: i,
            })),
          ).select("id"),
        );
      }
    }
    return loadRole(roleId);
  });

export const setRoleStatusFn = createServerFn({ method: "POST" })
  .validator((input: { roleId: string; status: RoleStatus }) => input)
  .handler(async ({ data }) => {
    unwrap(
      await getSupabase()
        .from("roles")
        .update({ status: data.status })
        .eq("id", data.roleId)
        .select("id"),
    );
    return { roleId: data.roleId, status: data.status };
  });

export const upsertTemplateFn = createServerFn({ method: "POST" })
  .validator((input: UpsertTemplateInput) => input)
  .handler(async ({ data }): Promise<EmailTemplate> => {
    const sb = getSupabase();
    const values = {
      name: data.name,
      used_for: data.usedFor,
      subject: data.subject,
      body: data.body,
      last_edited: new Date().toISOString(),
    };
    const row = data.id
      ? unwrap<TemplateRow>(
          await sb.from("email_templates").update(values).eq("id", data.id).select("*").single(),
        )
      : unwrap<TemplateRow>(
          await sb.from("email_templates").insert(values).select("*").single(),
        );
    return mapTemplate(row);
  });

export const setClinicNameFn = createServerFn({ method: "POST" })
  .validator((input: { clinicName: string }) => input)
  .handler(async ({ data }) => {
    unwrap(
      await getSupabase()
        .from("settings")
        .update({ clinic_name: data.clinicName })
        .eq("id", true)
        .select("id"),
    );
    return { clinicName: data.clinicName };
  });

/* ---------------- public (unauthenticated, scoped) ---------------- */

export const getPublicRoleFn = createServerFn({ method: "GET" })
  .validator((roleId: string) => roleId)
  .handler(async ({ data: roleId }) => {
    const sb = getSupabase();
    const [roleRes, settingsRes] = await Promise.all([
      sb.from("roles").select("title, department, status").eq("id", roleId).maybeSingle(),
      sb.from("settings").select("clinic_name").limit(1).maybeSingle(),
    ]);
    const role = unwrap<{ title: string; department: string; status: RoleStatus } | null>(roleRes);
    const settings = unwrap<{ clinic_name: string } | null>(settingsRes);
    return {
      clinicName: settings?.clinic_name ?? "",
      role: role ?? null,
    };
  });

export const submitPublicApplicationFn = createServerFn({ method: "POST" })
  .validator((input: Omit<AddApplicantInput, "source" | "notes" | "bulkImportId">) => input)
  .handler(async ({ data }) => {
    const role = await loadRole(data.roleId);
    if (role.status !== "open") throw new Error("This role is not accepting applications.");
    await createApplicant({ ...data, source: "public_form" });
    return { ok: true as const };
  });
