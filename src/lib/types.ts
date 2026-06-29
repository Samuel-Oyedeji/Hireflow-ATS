export type CriterionWeight = "required" | "preferred" | "nice-to-have";
export type RoleStatus = "open" | "closed";
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
}

export interface Applicant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  roleId: string;
  submittedDate: string; // ISO
  aiScore: number; // 0-100
  aiDecision: AiDecision;
  reasoning: string;
  criteriaResults: CriterionResult[];
  documents: ApplicantDocument[];
  humanDecision: HumanDecision;
  overrideReason?: string;
  decidedBy?: string;
  decidedDate?: string;
  invited?: boolean;
  invitedDate?: string;
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
}