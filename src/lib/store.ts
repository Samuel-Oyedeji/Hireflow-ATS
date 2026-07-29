import { useSyncExternalStore } from "react";
import type {
  AiDecision,
  AppState,
  Applicant,
  Assessment,
  BulkImport,
  Confidence,
  Criterion,
  CriteriaUpdate,
  CriterionMatch,
  CriterionResult,
  EmailTemplate,
  FinalDecision,
  HumanDecision,
  Role,
  TranscriptAnalysis,
  TranscriptSuggestion,
  TranscriptUpload,
} from "./types";

function cr(criterionId: string, match: "met" | "not-met" | "partial", note: string) {
  return { criterionId, match, note };
}

const roles: Role[] = [
  {
    id: "r1",
    title: "Registered physiotherapist",
    department: "Physiotherapy",
    status: "open",
    createdDate: "2026-05-20",
    criteria: [
      {
        id: "r1-c1",
        label: "Registration in good standing",
        detail:
          "Must hold a valid Physiotherapist registration with the College of Physiotherapists of Ontario.",
        weight: "required",
      },
      {
        id: "r1-c2",
        label: "Minimum years of experience",
        detail: "At least 3 years of clinical experience in an outpatient setting.",
        weight: "required",
      },
      {
        id: "r1-c3",
        label: "Pediatric experience",
        detail: "Experience treating pediatric patients.",
        weight: "preferred",
      },
      {
        id: "r1-c4",
        label: "Manual therapy certification",
        detail: "Completed manual therapy or dry needling certification.",
        weight: "nice-to-have",
      },
    ],
  },
  {
    id: "r2",
    title: "Registered massage therapist (RMT)",
    department: "Massage therapy",
    status: "open",
    createdDate: "2026-06-02",
    criteria: [
      {
        id: "r2-c1",
        label: "RMT registration",
        detail: "Valid RMT registration with the CMTO.",
        weight: "required",
      },
      {
        id: "r2-c2",
        label: "Evening & weekend availability",
        detail: "Available for evening and weekend shifts.",
        weight: "preferred",
      },
      {
        id: "r2-c3",
        label: "Deep tissue & sports massage",
        detail: "Trained in deep tissue and sports massage techniques.",
        weight: "preferred",
      },
    ],
  },
  {
    id: "r3",
    title: "Clinic front desk coordinator",
    department: "Administration",
    status: "open",
    createdDate: "2026-06-15",
    criteria: [
      {
        id: "r3-c1",
        label: "Scheduling / EMR software",
        detail: "Experience with clinic scheduling or EMR software (e.g. Jane, Telus).",
        weight: "required",
      },
      {
        id: "r3-c2",
        label: "Customer service experience",
        detail: "2+ years in a patient-facing or customer service role.",
        weight: "required",
      },
      {
        id: "r3-c3",
        label: "Bilingual (EN/FR)",
        detail: "Conversational French is an asset.",
        weight: "nice-to-have",
      },
    ],
  },
  {
    id: "r4",
    title: "Occupational therapist",
    department: "Occupational therapy",
    status: "closed",
    createdDate: "2026-04-10",
    criteria: [
      {
        id: "r4-c1",
        label: "OT registration",
        detail: "Registered with the College of Occupational Therapists of Ontario.",
        weight: "required",
      },
      {
        id: "r4-c2",
        label: "Home assessment experience",
        detail: "Experience conducting home safety assessments.",
        weight: "preferred",
      },
    ],
  },
];

const applicants: Applicant[] = [
  {
    id: "a1",
    name: "Sarah Mitchell",
    email: "sarah.mitchell@example.com",
    phone: "(416) 555-0142",
    roleId: "r1",
    submittedDate: "2026-06-18T09:12:00",
    aiScore: 87,
    aiDecision: "advanced",
    reasoning:
      "Holds a valid Physiotherapist registration with the College of Physiotherapists of Ontario. Has 4 years of outpatient clinical experience, above the 3-year minimum. Resume lists pediatric rotations during residency, satisfying the preferred pediatric experience. No manual therapy certification was found, which is only nice-to-have.",
    criteriaResults: [
      cr("r1-c1", "met", "Valid CPO registration confirmed on resume."),
      cr("r1-c2", "met", "4 years outpatient experience."),
      cr("r1-c3", "met", "Pediatric rotations noted during residency."),
      cr("r1-c4", "not-met", "No manual therapy certification listed."),
    ],
    documents: [
      { name: "Resume / CV", type: "resume", fileName: "sarah-mitchell-cv.pdf" },
      { name: "Cover letter", type: "cover-letter", fileName: "sarah-mitchell-cover.pdf" },
    ],
    humanDecision: "advance",
    decidedBy: "Jordan Avery",
    decidedDate: "2026-06-20",
    invited: true,
    invitedDate: "2026-06-24",
  },
  {
    id: "a2",
    name: "David Chen",
    email: "david.chen@example.com",
    phone: "(647) 555-0199",
    roleId: "r1",
    submittedDate: "2026-06-21T14:37:00",
    aiScore: 78,
    aiDecision: "advanced",
    reasoning:
      "Meets required CPO registration. Has 3 years of clinical experience, exactly at the minimum. Cover letter does not mention experience with pediatric patients, listed as preferred. Holds a dry needling certification, a nice-to-have.",
    criteriaResults: [
      cr("r1-c1", "met", "CPO registration verified."),
      cr("r1-c2", "met", "3 years experience, meets minimum."),
      cr("r1-c3", "not-met", "No pediatric experience mentioned."),
      cr("r1-c4", "met", "Dry needling certification listed."),
    ],
    documents: [
      { name: "Resume / CV", type: "resume", fileName: "david-chen-resume.pdf" },
    ],
    humanDecision: null,
  },
  {
    id: "a3",
    name: "Priya Nair",
    email: "priya.nair@example.com",
    phone: "(905) 555-0177",
    roleId: "r1",
    submittedDate: "2026-06-19T11:05:00",
    aiScore: 54,
    aiDecision: "rejected",
    reasoning:
      "Registration could not be verified against the College of Physiotherapists of Ontario; the required credential appears to be from another province. Has 5 years of experience, but the missing required registration is disqualifying for this posting.",
    criteriaResults: [
      cr("r1-c1", "not-met", "Registration appears to be out-of-province."),
      cr("r1-c2", "met", "5 years experience."),
      cr("r1-c3", "partial", "Some pediatric exposure, not primary focus."),
      cr("r1-c4", "met", "Manual therapy certification listed."),
    ],
    documents: [
      { name: "Resume / CV", type: "resume", fileName: "priya-nair-cv.pdf" },
      { name: "Cover letter", type: "cover-letter", fileName: "priya-nair-cover.pdf" },
    ],
    humanDecision: "reject",
    decidedBy: "Jordan Avery",
    decidedDate: "2026-06-22",
  },
  {
    id: "a4",
    name: "Tomás Romero",
    email: "tomas.romero@example.com",
    phone: "(416) 555-0123",
    roleId: "r1",
    submittedDate: "2026-06-22T16:48:00",
    aiScore: 61,
    aiDecision: "rejected",
    reasoning:
      "Registration is valid, but only 2 years of outpatient experience were detected, below the 3-year minimum. Strong pediatric background and manual therapy certification present.",
    criteriaResults: [
      cr("r1-c1", "met", "CPO registration verified."),
      cr("r1-c2", "not-met", "2 years experience, below minimum."),
      cr("r1-c3", "met", "Strong pediatric background."),
      cr("r1-c4", "met", "Manual therapy certification listed."),
    ],
    documents: [
      { name: "Resume / CV", type: "resume", fileName: "tomas-romero-resume.pdf" },
      { name: "Reference letter", type: "other", fileName: "tomas-romero-reference.pdf" },
    ],
    humanDecision: "advance",
    overrideReason:
      "Candidate's pediatric specialization is a strong fit for our new family clinic; the experience gap is minor and offset by certifications.",
    decidedBy: "Jordan Avery",
    decidedDate: "2026-06-23",
  },
  {
    id: "a5",
    name: "Jessica Brown",
    email: "jessica.brown@example.com",
    phone: "(437) 555-0150",
    roleId: "r2",
    submittedDate: "2026-06-24T08:41:00",
    aiScore: 90,
    aiDecision: "advanced",
    reasoning:
      "Valid RMT registration with the CMTO. Indicated full availability including evenings and weekends. Trained in both deep tissue and sports massage, satisfying both preferred criteria.",
    criteriaResults: [
      cr("r2-c1", "met", "CMTO registration verified."),
      cr("r2-c2", "met", "Full evening and weekend availability."),
      cr("r2-c3", "met", "Deep tissue and sports massage training."),
    ],
    documents: [
      { name: "Resume / CV", type: "resume", fileName: "jessica-brown-cv.pdf" },
      { name: "Cover letter", type: "cover-letter", fileName: "jessica-brown-cover.pdf" },
    ],
    humanDecision: null,
  },
  {
    id: "a6",
    name: "Michael O'Connor",
    email: "michael.oconnor@example.com",
    phone: "(289) 555-0188",
    roleId: "r2",
    submittedDate: "2026-06-25T13:22:00",
    aiScore: 48,
    aiDecision: "rejected",
    reasoning:
      "No active CMTO registration could be confirmed; the required RMT credential appears to be expired. Limited availability with no evening or weekend shifts indicated.",
    criteriaResults: [
      cr("r2-c1", "not-met", "RMT registration appears expired."),
      cr("r2-c2", "not-met", "No evening or weekend availability."),
      cr("r2-c3", "partial", "General massage background only."),
    ],
    documents: [{ name: "Resume / CV", type: "resume", fileName: "michael-oconnor-resume.pdf" }],
    humanDecision: null,
  },
  {
    id: "a7",
    name: "Aisha Khan",
    email: "aisha.khan@example.com",
    phone: "(416) 555-0166",
    roleId: "r2",
    submittedDate: "2026-06-17T10:58:00",
    aiScore: 84,
    aiDecision: "advanced",
    reasoning:
      "Valid CMTO registration. Available for weekend shifts but limited evening availability. Strong deep tissue background with some sports massage experience.",
    criteriaResults: [
      cr("r2-c1", "met", "CMTO registration verified."),
      cr("r2-c2", "partial", "Weekend availability, limited evenings."),
      cr("r2-c3", "met", "Deep tissue specialist."),
    ],
    documents: [{ name: "Resume / CV", type: "resume", fileName: "aisha-khan-cv.pdf" }],
    humanDecision: "advance",
    decidedBy: "Jordan Avery",
    decidedDate: "2026-06-25",
    invited: true,
    invitedDate: "2026-06-26",
  },
  {
    id: "a8",
    name: "Emily Watson",
    email: "emily.watson@example.com",
    phone: "(613) 555-0144",
    roleId: "r3",
    submittedDate: "2026-06-26T15:09:00",
    aiScore: 76,
    aiDecision: "advanced",
    reasoning:
      "Three years of experience with Jane scheduling software, meeting the required EMR criterion. Four years in a patient-facing reception role. No French proficiency noted, a nice-to-have.",
    criteriaResults: [
      cr("r3-c1", "met", "3 years with Jane software."),
      cr("r3-c2", "met", "4 years patient-facing reception."),
      cr("r3-c3", "not-met", "No French proficiency noted."),
    ],
    documents: [
      { name: "Resume / CV", type: "resume", fileName: "emily-watson-resume.pdf" },
      { name: "Cover letter", type: "cover-letter", fileName: "emily-watson-cover.pdf" },
    ],
    humanDecision: null,
  },
  {
    id: "a9",
    name: "Robert Singh",
    email: "robert.singh@example.com",
    phone: "(905) 555-0133",
    roleId: "r3",
    submittedDate: "2026-06-23T12:33:00",
    aiScore: 58,
    aiDecision: "rejected",
    reasoning:
      "No experience with clinic scheduling or EMR software was found, a required criterion. Has general administrative experience but not in a healthcare setting.",
    criteriaResults: [
      cr("r3-c1", "not-met", "No scheduling/EMR software experience."),
      cr("r3-c2", "partial", "Administrative, not patient-facing."),
      cr("r3-c3", "met", "Fluent in French."),
    ],
    documents: [{ name: "Resume / CV", type: "resume", fileName: "robert-singh-cv.pdf" }],
    humanDecision: "reject",
    decidedBy: "Jordan Avery",
    decidedDate: "2026-06-24",
  },
  {
    id: "a10",
    name: "Linda Park",
    email: "linda.park@example.com",
    phone: "(416) 555-0111",
    roleId: "r4",
    submittedDate: "2026-04-15T09:47:00",
    aiScore: 88,
    aiDecision: "advanced",
    reasoning:
      "Registered with the College of Occupational Therapists of Ontario. Extensive experience conducting home safety assessments, satisfying the preferred criterion.",
    criteriaResults: [
      cr("r4-c1", "met", "COTO registration verified."),
      cr("r4-c2", "met", "Extensive home assessment experience."),
    ],
    documents: [
      { name: "Resume / CV", type: "resume", fileName: "linda-park-cv.pdf" },
      { name: "Cover letter", type: "cover-letter", fileName: "linda-park-cover.pdf" },
    ],
    humanDecision: "advance",
    decidedBy: "Jordan Avery",
    decidedDate: "2026-04-18",
    invited: true,
    invitedDate: "2026-04-19",
  },
];

const templates: EmailTemplate[] = [
  {
    id: "t1",
    name: "Interview invite — physiotherapist",
    usedFor: "Interview invite",
    subject: "Interview invitation for the {{role_title}} role at {{clinic_name}}",
    body: "Hi {{applicant_name}},\n\nThank you for applying for the {{role_title}} position at {{clinic_name}}. We were impressed by your application and would like to invite you to an interview.\n\nPlease use the link below to choose a time that works for you:\n{{interview_scheduling_link}}\n\nWe look forward to speaking with you.\n\nWarm regards,\nThe {{clinic_name}} hiring team",
    lastEdited: "2026-06-12",
  },
  {
    id: "t2",
    name: "General interview invite",
    usedFor: "Interview invite",
    subject: "You're invited to interview at {{clinic_name}}",
    body: "Hi {{applicant_name}},\n\nWe've reviewed your application for the {{role_title}} role and would love to learn more about you. Please book an interview slot here:\n{{interview_scheduling_link}}\n\nThank you,\n{{clinic_name}}",
    lastEdited: "2026-06-05",
  },
];

let state: AppState = {
  currentUser: "Jordan Avery",
  clinicName: "Riverside Clinic Group",
  roles,
  applicants,
  templates,
  bulkImports: [],
};

const listeners = new Set<() => void>();

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const matchToAssessment: Record<CriterionMatch, Assessment> = {
  met: "met",
  "not-met": "not_met",
  partial: "unclear",
};

/**
 * Simulated interview-transcript analysis. Mirrors the mock AI screening: it is
 * deterministic given the applicant's screening result and the role criteria, so
 * demos are stable. An obviously-unusable file (very short / "empty"/"blank" name)
 * returns an error flag instead of a low-confidence guess, per the spec.
 */
function simulateTranscriptAnalysis(
  applicant: Applicant,
  role: Role | undefined,
  transcriptUploadId: string,
  fileName: string,
  text?: string,
): TranscriptAnalysis {
  // Usability is judged from the pasted transcript text when provided, otherwise
  // from the uploaded file name (the file's contents aren't available in this demo).
  const base = fileName.replace(/\.[^.]+$/, "").trim().toLowerCase();
  const unusable =
    text !== undefined
      ? text.trim().length < 20
      : base.length < 3 || /(empty|blank|invalid|untitled)/.test(base);
  if (unusable) {
    return {
      id: uid("ta"),
      transcriptUploadId,
      overallSuggestion: "further_review",
      confidence: "low",
      summary: "",
      strengths: [],
      concerns: [],
      criteriaUpdate: [],
      suggestedNextStep: "",
      createdAt: todayISO(),
      errorFlag: true,
      errorReason:
        "This doesn't look like a usable interview transcript. Please provide the full transcript and try again.",
    };
  }

  const score = applicant.aiScore;
  const overallSuggestion: TranscriptSuggestion =
    score >= 75 ? "hire" : score >= 60 ? "further_review" : "reject";
  const dist = Math.abs(score - 67);
  const confidence: Confidence = dist >= 15 ? "high" : dist >= 7 ? "medium" : "low";
  const critLabel = (id: string) => role?.criteria.find((c) => c.id === id)?.label;

  const criteriaUpdate: CriteriaUpdate[] = applicant.criteriaResults.map((res) => {
    const original = matchToAssessment[res.match];
    // The interview tends to resolve anything the resume left unclear.
    const updated: Assessment = original === "unclear" ? (score >= 65 ? "met" : "not_met") : original;
    const note =
      updated !== original
        ? `Unclear from the resume — the interview ${updated === "met" ? "confirmed this is met" : "showed this is not met"}.`
        : original === "met"
          ? "Consistent with the resume and reinforced in the interview."
          : original === "not_met"
            ? "Remains a gap after the interview."
            : "Still unclear after the interview.";
    return {
      criterionId: res.criterionId,
      originalAssessment: original,
      updatedAssessment: updated,
      note,
    };
  });

  const metLabels = criteriaUpdate
    .filter((c) => c.updatedAssessment === "met")
    .map((c) => critLabel(c.criterionId))
    .filter((l): l is string => !!l);
  const gapLabels = criteriaUpdate
    .filter((c) => c.updatedAssessment === "not_met")
    .map((c) => critLabel(c.criterionId))
    .filter((l): l is string => !!l);

  const strengths = metLabels.slice(0, 3).map((l) => `Demonstrated ${l.toLowerCase()} during the interview.`);
  if (strengths.length === 0) {
    strengths.push("Communicated clearly and engaged well with the interview questions.");
  }
  const concerns = gapLabels.slice(0, 3).map((l) => `Did not fully demonstrate ${l.toLowerCase()}.`);
  if (concerns.length === 0 && overallSuggestion !== "hire") {
    concerns.push("Some responses lacked depth relevant to the role.");
  }

  const roleName = role?.title ?? "the role";
  const summary =
    overallSuggestion === "hire"
      ? `The candidate interviewed strongly for ${roleName}, backing up the resume screening with concrete examples well aligned to the role's criteria.`
      : overallSuggestion === "further_review"
        ? `The candidate showed promise for ${roleName} but left some criteria only partly addressed. A closer look is warranted before deciding.`
        : `The interview surfaced gaps against ${roleName}'s required criteria that the resume alone did not resolve.`;

  const suggestedNextStep =
    overallSuggestion === "hire"
      ? "Proceed to offer."
      : overallSuggestion === "further_review"
        ? `Request a second interview to probe ${(gapLabels[0] ?? "the remaining criteria").toLowerCase()} further.`
        : "Do not proceed; send a considerate rejection and keep the résumé on file.";

  return {
    id: uid("ta"),
    transcriptUploadId,
    overallSuggestion,
    confidence,
    summary,
    strengths,
    concerns,
    criteriaUpdate,
    suggestedNextStep,
    createdAt: todayISO(),
    errorFlag: false,
  };
}

/**
 * Simulated AI screening result. Used both when an applicant is first uploaded
 * and when documents are added later and the screening is re-run. Mirrors the
 * mock elsewhere in this file — score is random within a band, and the per-criterion
 * matches follow a fixed pattern off that score so the UI always has something to show.
 */
function simulateScreening(role: Role | undefined): {
  aiScore: number;
  aiDecision: AiDecision;
  reasoning: string;
  criteriaResults: CriterionResult[];
} {
  const score = 60 + Math.floor(Math.random() * 38);
  const aiDecision: AiDecision = score >= 70 ? "advanced" : "rejected";
  const criteriaResults: CriterionResult[] =
    role?.criteria.map((c, i) => ({
      criterionId: c.id,
      match: (score >= 70
        ? i % 4 === 3
          ? "partial"
          : "met"
        : i % 2 === 0
          ? "not-met"
          : "met") as CriterionMatch,
      note: "Assessed from submitted documents.",
    })) ?? [];
  const reasoning =
    aiDecision === "advanced"
      ? "The applicant meets the required criteria for this role based on the submitted documents, with a strong overall match to the screening profile."
      : "The applicant does not currently meet one or more required criteria for this role based on the submitted documents.";
  return { aiScore: score, aiDecision, reasoning, criteriaResults };
}

/* ---------------- Actions ---------------- */

export const actions = {
  upsertRole(role: Omit<Role, "id" | "createdDate"> & { id?: string; createdDate?: string }): string {
    if (role.id) {
      const id = role.id;
      state.roles = state.roles.map((r) =>
        r.id === id ? { ...r, ...role, id, createdDate: r.createdDate } : r,
      );
      emit();
      return id;
    }
    const id = uid("r");
    const newRole: Role = {
      id,
      title: role.title,
      department: role.department,
      status: role.status,
      criteria: role.criteria as Criterion[],
      createdDate: todayISO(),
    };
    state.roles = [newRole, ...state.roles];
    emit();
    return id;
  },

  setRoleStatus(roleId: string, status: Role["status"]) {
    state.roles = state.roles.map((r) => (r.id === roleId ? { ...r, status } : r));
    emit();
  },

  addApplicant(input: {
    name: string;
    email: string;
    phone?: string;
    roleId: string;
    documents: Applicant["documents"];
    source?: Applicant["source"];
    notes?: string;
    bulkImportId?: string;
  }): string {
    const role = state.roles.find((r) => r.id === input.roleId);
    const id = uid("a");
    const newApplicant: Applicant = {
      id,
      name: input.name,
      email: input.email,
      phone: input.phone,
      roleId: input.roleId,
      source: input.source ?? "manual_upload",
      notes: input.notes,
      bulkImportId: input.bulkImportId,
      submittedDate: new Date().toISOString(),
      ...simulateScreening(role),
      documents: input.documents,
      humanDecision: null,
    };
    state.applicants = [newApplicant, ...state.applicants];
    emit();
    return id;
  },

  /**
   * Add documents to an existing applicant and re-run AI screening against the
   * role's criteria using all documents on file. The human decision (if any) is
   * left untouched — re-screening informs the reviewer, it doesn't override them.
   */
  addDocuments(applicantId: string, documents: Applicant["documents"]) {
    state.applicants = state.applicants.map((a) => {
      if (a.id !== applicantId) return a;
      const role = state.roles.find((r) => r.id === a.roleId);
      return {
        ...a,
        documents: [...a.documents, ...documents],
        ...simulateScreening(role),
      };
    });
    emit();
  },

  createBulkImport(input: {
    roleId: string;
    fileName: string;
    importedBy: string;
    totalFiles: number;
    successful: number;
    failed: number;
    skipped: number;
  }): string {
    const id = uid("bulk");
    const record: BulkImport = { id, createdAt: todayISO(), ...input };
    state.bulkImports = [record, ...state.bulkImports];
    emit();
    return id;
  },

  analyzeTranscript(
    applicantId: string,
    input: { fileName: string; text?: string },
    user: string,
  ): TranscriptAnalysis | undefined {
    const applicant = state.applicants.find((a) => a.id === applicantId);
    if (!applicant) return;
    const role = state.roles.find((r) => r.id === applicant.roleId);
    const transcript: TranscriptUpload = {
      id: uid("tr"),
      fileName: input.fileName,
      uploadedAt: todayISO(),
      uploadedBy: user,
    };
    const analysis = simulateTranscriptAnalysis(
      applicant,
      role,
      transcript.id,
      input.fileName,
      input.text,
    );
    state.applicants = state.applicants.map((a) =>
      a.id === applicantId ? { ...a, transcript, transcriptAnalysis: analysis } : a,
    );
    emit();
    return analysis;
  },

  saveFinalDecision(
    applicantId: string,
    decision: TranscriptSuggestion,
    overrideReason: string,
    user: string,
  ) {
    state.applicants = state.applicants.map((a) => {
      if (a.id !== applicantId) return a;
      const suggestion = a.transcriptAnalysis?.overallSuggestion;
      const isOverride = suggestion !== undefined && decision !== suggestion;
      const finalDecision: FinalDecision = {
        id: uid("fd"),
        transcriptAnalysisId: a.transcriptAnalysis?.id,
        decision,
        isOverride,
        overrideReason: isOverride && overrideReason ? overrideReason : undefined,
        decidedBy: user,
        createdAt: todayISO(),
      };
      return { ...a, finalDecision };
    });
    emit();
  },

  saveDecision(applicantId: string, decision: HumanDecision, overrideReason: string, user: string) {
    state.applicants = state.applicants.map((a) =>
      a.id === applicantId
        ? {
            ...a,
            humanDecision: decision,
            overrideReason: overrideReason || undefined,
            decidedBy: user,
            decidedDate: todayISO(),
          }
        : a,
    );
    emit();
  },

  clearDecision(applicantId: string) {
    state.applicants = state.applicants.map((a) =>
      a.id === applicantId
        ? {
            ...a,
            humanDecision: null,
            overrideReason: undefined,
            decidedBy: undefined,
            decidedDate: undefined,
          }
        : a,
    );
    emit();
  },

  sendInvites(applicantIds: string[]) {
    const date = todayISO();
    state.applicants = state.applicants.map((a) =>
      applicantIds.includes(a.id) ? { ...a, invited: true, invitedDate: date } : a,
    );
    emit();
  },

  upsertTemplate(
    tpl: Omit<EmailTemplate, "id" | "lastEdited"> & { id?: string },
  ): string {
    if (tpl.id) {
      const id = tpl.id;
      state.templates = state.templates.map((t) =>
        t.id === id ? { ...t, ...tpl, id, lastEdited: todayISO() } : t,
      );
      emit();
      return id;
    }
    const id = uid("t");
    state.templates = [
      { id, lastEdited: todayISO(), ...tpl } as EmailTemplate,
      ...state.templates,
    ];
    emit();
    return id;
  },

  setClinicName(name: string) {
    state.clinicName = name;
    emit();
  },
};