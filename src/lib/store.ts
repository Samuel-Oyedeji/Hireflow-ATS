import { useSyncExternalStore } from "react";

import type {
  AppState,
  Applicant,
  EmailTemplate,
  HumanDecision,
  Role,
  RoleStatus,
  TranscriptAnalysis,
  TranscriptSuggestion,
} from "./types";
import {
  addApplicantFn,
  addDocumentsFn,
  analyzeTranscriptFn,
  clearDecisionFn,
  createBulkImportFn,
  getAppState,
  rescreenApplicantFn,
  saveDecisionFn,
  saveFinalDecisionFn,
  sendInvitesFn,
  setClinicNameFn,
  setInterviewLinkFn,
  setRoleStatusFn,
  upsertRoleFn,
  upsertTemplateFn,
  type AddApplicantInput,
  type CreateBulkImportInput,
  type DocInput,
  type UpsertRoleInput,
  type UpsertTemplateInput,
} from "./data";

/**
 * Client cache of the app's data, hydrated once from Supabase via server functions.
 * The public API (`useAppState`, `actions`) is unchanged from the in-memory version;
 * only the internals now persist. Actions call a server function, then patch this
 * cache with the authoritative record it returns and notify subscribers.
 */
let state: AppState = {
  currentUser: "",
  clinicName: "",
  interviewLink: "",
  roles: [],
  applicants: [],
  templates: [],
  bulkImports: [],
};

let loaded = false;
let hydrating: Promise<void> | null = null;

const listeners = new Set<() => void>();

function emit() {
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

/** True once the initial Supabase fetch has populated the cache. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => loaded,
    () => loaded,
  );
}

/** Fetch all data from Supabase into the cache. Runs at most once (client-side). */
export function hydrate(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!hydrating) {
    hydrating = getAppState()
      .then((next) => {
        state = next;
        loaded = true;
        emit();
      })
      .catch((err) => {
        hydrating = null; // allow a retry
        throw err;
      });
  }
  return hydrating;
}

/* ---------------- cache patch helpers ---------------- */

function upsertBy<T extends { id: string }>(arr: T[], item: T): T[] {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...arr];
  const next = arr.slice();
  next[i] = item;
  return next;
}

function setApplicant(applicant: Applicant) {
  state = { ...state, applicants: upsertBy(state.applicants, applicant) };
  emit();
}

function setRole(role: Role) {
  state = { ...state, roles: upsertBy(state.roles, role) };
  emit();
}

function setTemplate(template: EmailTemplate) {
  state = { ...state, templates: upsertBy(state.templates, template) };
  emit();
}

/* ---------------- Actions ---------------- */

export const actions = {
  async upsertRole(role: UpsertRoleInput): Promise<string> {
    const saved = await upsertRoleFn({ data: role });
    setRole(saved);
    return saved.id;
  },

  async setRoleStatus(roleId: string, status: RoleStatus): Promise<void> {
    await setRoleStatusFn({ data: { roleId, status } });
    state = {
      ...state,
      roles: state.roles.map((r) => (r.id === roleId ? { ...r, status } : r)),
    };
    emit();
  },

  async addApplicant(input: AddApplicantInput): Promise<string> {
    const applicant = await addApplicantFn({ data: input });
    setApplicant(applicant);
    return applicant.id;
  },

  async addDocuments(applicantId: string, documents: DocInput[]): Promise<void> {
    const applicant = await addDocumentsFn({ data: { applicantId, documents } });
    setApplicant(applicant);
  },

  async rescreenApplicant(applicantId: string): Promise<void> {
    const applicant = await rescreenApplicantFn({ data: { applicantId } });
    setApplicant(applicant);
  },

  async createBulkImport(input: CreateBulkImportInput): Promise<string> {
    const record = await createBulkImportFn({ data: input });
    state = { ...state, bulkImports: [record, ...state.bulkImports] };
    emit();
    return record.id;
  },

  async analyzeTranscript(
    applicantId: string,
    input: { fileName: string; storagePath?: string; text?: string },
    user: string,
  ): Promise<TranscriptAnalysis | undefined> {
    const applicant = await analyzeTranscriptFn({
      data: {
        applicantId,
        fileName: input.fileName,
        storagePath: input.storagePath,
        text: input.text,
        uploadedBy: user,
      },
    });
    setApplicant(applicant);
    return applicant.transcriptAnalysis;
  },

  async saveFinalDecision(
    applicantId: string,
    decision: TranscriptSuggestion,
    overrideReason: string,
    user: string,
  ): Promise<void> {
    const applicant = await saveFinalDecisionFn({
      data: { applicantId, decision, overrideReason, decidedBy: user },
    });
    setApplicant(applicant);
  },

  async saveDecision(
    applicantId: string,
    decision: HumanDecision,
    overrideReason: string,
    user: string,
  ): Promise<void> {
    const applicant = await saveDecisionFn({
      data: { applicantId, decision, overrideReason, decidedBy: user },
    });
    setApplicant(applicant);
  },

  async clearDecision(applicantId: string): Promise<void> {
    const applicant = await clearDecisionFn({ data: { applicantId } });
    setApplicant(applicant);
  },

  async sendInvites(applicantIds: string[]): Promise<void> {
    const { invitedDate } = await sendInvitesFn({ data: { applicantIds } });
    const ids = new Set(applicantIds);
    state = {
      ...state,
      applicants: state.applicants.map((a) =>
        ids.has(a.id) ? { ...a, invited: true, invitedDate } : a,
      ),
    };
    emit();
  },

  async upsertTemplate(tpl: UpsertTemplateInput): Promise<string> {
    const saved = await upsertTemplateFn({ data: tpl });
    setTemplate(saved);
    return saved.id;
  },

  async setClinicName(name: string): Promise<void> {
    await setClinicNameFn({ data: { clinicName: name } });
    state = { ...state, clinicName: name };
    emit();
  },

  async setInterviewLink(link: string): Promise<void> {
    await setInterviewLinkFn({ data: { interviewLink: link } });
    state = { ...state, interviewLink: link };
    emit();
  },
};
