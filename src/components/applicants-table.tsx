import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { Applicant, Role } from "@/lib/types";
import {
  formatDate,
  humanStatus,
  humanStatusLabel,
  lifecycleStage,
  roleById,
} from "@/lib/hireflow";
import { Button } from "@/components/ui/button";
import { StatusBadge, Dot, aiDecisionTone } from "@/components/status-badge";
import { MarkInterviewedDialog } from "@/components/mark-interviewed-dialog";

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground", className)}>
      {children}
    </th>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("h-[52px] px-4 align-middle", className)}>{children}</td>;
}

function humanTone(a: Applicant) {
  const s = humanStatus(a);
  return s === "awaiting" ? "warning" : s === "confirmed" ? "info" : "neutral";
}

export function ApplicantsTable({
  applicants,
  roles,
  showRole = false,
}: {
  applicants: Applicant[];
  roles: Role[];
  showRole?: boolean;
}) {
  const [interviewFor, setInterviewFor] = useState<Applicant | null>(null);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-secondary/40">
            <tr className="border-b border-border text-left">
              <Th>Name</Th>
              {showRole && <Th>Role</Th>}
              <Th>Submitted</Th>
              <Th>AI score</Th>
              <Th>AI decision</Th>
              <Th>Human status</Th>
              <Th className="text-right" />
            </tr>
          </thead>
          <tbody>
            {applicants.map((a) => {
              const role = roleById(roles, a.roleId);
              return (
                <tr key={a.id} className="border-b border-border transition-colors last:border-0 hover:bg-secondary/50">
                  <Td>
                    <Link
                      to="/applicants/$applicantId"
                      params={{ applicantId: a.id }}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {a.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{a.email}</div>
                  </Td>
                  {showRole && (
                    <Td className="text-muted-foreground">{role?.title ?? "—"}</Td>
                  )}
                  <Td className="text-muted-foreground whitespace-nowrap">{formatDate(a.submittedDate)}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-2 font-medium tabular-nums text-foreground">
                      <Dot tone={aiDecisionTone(a.aiDecision)} />
                      {a.aiScore}/100
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge tone={aiDecisionTone(a.aiDecision)}>
                      {a.aiDecision === "advanced" ? "Advanced" : "Rejected"}
                    </StatusBadge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={humanTone(a)}>{humanStatusLabel(a)}</StatusBadge>
                      {a.invited && (
                        <span className="text-xs font-medium text-success">Invited</span>
                      )}
                    </div>
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {lifecycleStage(a) === "invited" && (
                        <Button variant="outline" size="sm" onClick={() => setInterviewFor(a)}>
                          Mark interviewed
                        </Button>
                      )}
                      <Button asChild variant="outline" size="sm">
                        <Link to="/applicants/$applicantId" params={{ applicantId: a.id }}>
                          Review
                        </Link>
                      </Button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {interviewFor && (
        <MarkInterviewedDialog
          applicant={interviewFor}
          open={interviewFor !== null}
          onOpenChange={(v) => !v && setInterviewFor(null)}
        />
      )}
    </div>
  );
}