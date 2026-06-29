import { format, parseISO, differenceInCalendarDays } from "date-fns";
import type { Applicant, Role, WorkingStatus } from "./types";

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

export function workingStatus(a: Applicant): WorkingStatus {
  if (a.humanDecision === null) return "pending";
  return a.humanDecision === "advance" ? "advanced" : "rejected";
}

export type HumanStatus = "awaiting" | "confirmed" | "overridden";

export function humanStatus(a: Applicant): HumanStatus {
  if (a.humanDecision === null) return "awaiting";
  const matchesAi =
    (a.humanDecision === "advance" && a.aiDecision === "advanced") ||
    (a.humanDecision === "reject" && a.aiDecision === "rejected");
  return matchesAi ? "confirmed" : "overridden";
}

export function humanStatusLabel(a: Applicant): string {
  const s = humanStatus(a);
  return s === "awaiting" ? "Awaiting review" : s === "confirmed" ? "Confirmed" : "Overridden";
}

export function applicantsForRole(applicants: Applicant[], roleId: string): Applicant[] {
  return applicants.filter((a) => a.roleId === roleId);
}

export interface RoleCounts {
  total: number;
  advanced: number;
  rejected: number;
  pending: number;
}

export function roleCounts(applicants: Applicant[], roleId: string): RoleCounts {
  const list = applicantsForRole(applicants, roleId);
  const counts: RoleCounts = { total: list.length, advanced: 0, rejected: 0, pending: 0 };
  for (const a of list) counts[workingStatus(a)]++;
  return counts;
}

export function isWithinWeek(iso?: string): boolean {
  if (!iso) return false;
  try {
    return differenceInCalendarDays(new Date(), parseISO(iso)) <= 7;
  } catch {
    return false;
  }
}

export function invitedThisWeek(applicants: Applicant[]): number {
  return applicants.filter((a) => a.invited && isWithinWeek(a.invitedDate)).length;
}

export function pendingReviewCount(applicants: Applicant[]): number {
  return applicants.filter((a) => a.humanDecision === null).length;
}

/** Applicants HR has advanced (eligible for interview invites) and not yet invited. */
export function inviteEligible(applicants: Applicant[], roleId: string): Applicant[] {
  return applicantsForRole(applicants, roleId).filter(
    (a) => a.humanDecision === "advance" && !a.invited,
  );
}

export function renderTemplate(
  text: string,
  vars: { applicant_name: string; role_title: string; clinic_name: string },
): string {
  return text
    .replaceAll("{{applicant_name}}", vars.applicant_name)
    .replaceAll("{{role_title}}", vars.role_title)
    .replaceAll("{{clinic_name}}", vars.clinic_name)
    .replaceAll("{{interview_scheduling_link}}", "https://riverside-clinic.example/book/abc123");
}

export function roleById(roles: Role[], id: string): Role | undefined {
  return roles.find((r) => r.id === id);
}

export const weightLabel: Record<string, string> = {
  required: "Required",
  preferred: "Preferred",
  "nice-to-have": "Nice-to-have",
};