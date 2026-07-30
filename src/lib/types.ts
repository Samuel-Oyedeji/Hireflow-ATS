export type CriterionWeight = "required" | "preferred" | "nice-to-have";
export type RoleStatus = "open" | "closed";
export type ApplicantSource = "manual_upload" | "public_form" | "bulk_import";
export type AiDecision = "advanced" | "rejected";
export type HumanDecision = "advance" | "reject" | null;
export type CriterionMatch = "met" | "not-met" | "partial";

export interface Criterion {
  id: string;
  label: string;
  detail: string;
  weight: CriterionWeight;
}

export interface Role {
  id: string;
  title: string;
  department: string;
  status: RoleStatus;
  criteria: Criterion[];
  createdDate: string; // ISO
}

export interface CriterionResult {
  criterionId: string;
  match: CriterionMatch;
  note: string;
}

export interface ApplicantDocument {
  name: string;
  type: "resume" | "cover-letter" | "other";
  fileName: string;
  storagePath?: string; // path in the private Supabase bucket; absent for legacy/demo docs
}

export interface Applicant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  roleId: string;
  source?: ApplicantSource; // how the applicant entered — missing is treated as "manual_upload"
  notes?: string; // internal HR note, not shown to applicants
  bulkImportId?: string; // groups applicants created in the same bulk import
  submittedDate: string; // ISO
  aiScore: number; // 0-100
  aiDecision: AiDecision;
  reasoning: string;
  education: string[]; // qualifications the screener read from the documents
  workHistory: string[]; // roles the screener read from the documents
  criteriaResults: CriterionResult[];
  documents: ApplicantDocument[];
  humanDecision: HumanDecision;
  overrideReason?: string;
  decidedBy?: string;
  decidedDate?: string;
  invited?: boolean;
  invitedDate?: string;
  transcript?: TranscriptUpload;
  transcriptAnalysis?: TranscriptAnalysis;
  finalDecision?: FinalDecision;
}

export type TranscriptSuggestion = "hire" | "reject" | "further_review";
export type Confidence = "high" | "medium" | "low";
export type Assessment = "met" | "not_met" | "unclear";

export interface TranscriptUpload {
  id: string;
  fileName: string;
  uploadedAt: string; // ISO
  uploadedBy: string;
}

export interface CriteriaUpdate {
  criterionId: string;
  originalAssessment: Assessment;
  updatedAssessment: Assessment;
  note: string;
}

export interface TranscriptAnalysis {
  id: string;
  transcriptUploadId: string;
  overallSuggestion: TranscriptSuggestion;
  confidence: Confidence;
  summary: string;
  strengths: string[];
  concerns: string[];
  criteriaUpdate: CriteriaUpdate[];
  suggestedNextStep: string;
  createdAt: string; // ISO
  errorFlag: boolean; // true if the transcript couldn't be analysed
  errorReason?: string;
}

export interface FinalDecision {
  id: string;
  transcriptAnalysisId?: string; // nullable — a decision can be made without a transcript
  decision: TranscriptSuggestion;
  isOverride: boolean;
  overrideReason?: string;
  decidedBy: string;
  createdAt: string; // ISO
}

export interface BulkImport {
  id: string;
  roleId: string;
  importedBy: string;
  fileName: string;
  totalFiles: number;
  successful: number;
  failed: number;
  skipped: number;
  createdAt: string; // ISO
}

export interface EmailTemplate {
  id: string;
  name: string;
  usedFor: string;
  subject: string;
  body: string;
  lastEdited: string; // ISO
}

/** Working status used for counts and tabs — mutually exclusive. */
export type WorkingStatus = "advanced" | "rejected" | "pending";

export interface AppState {
  currentUser: string;
  clinicName: string;
  roles: Role[];
  applicants: Applicant[];
  templates: EmailTemplate[];
  bulkImports: BulkImport[];
}