import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileCheck } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge, Dot, aiDecisionTone } from "@/components/status-badge";
import { MarkInterviewedDialog } from "@/components/mark-interviewed-dialog";
import { BulkMarkInterviewedDialog } from "@/components/bulk-mark-interviewed-dialog";

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
  selectable = false,
}: {
  applicants: Applicant[];
  roles: Role[];
  showRole?: boolean;
  /** Enables per-row selection and the bulk "mark interviewed" action. */
  selectable?: boolean;
}) {
  const [interviewFor, setInterviewFor] = useState<Applicant | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  // Only invited-stage applicants can be marked interviewed, so only they are selectable.
  const eligibleIds = applicants
    .filter((a) => lifecycleStage(a) === "invited")
    .map((a) => a.id);
  const selectedApplicants = applicants.filter((a) => selected.has(a.id));
  const allSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id));
  const someSelected = eligibleIds.some((id) => selected.has(id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) eligibleIds.forEach((id) => next.delete(id));
      else eligibleIds.forEach((id) => next.add(id));
      return next;
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }

  return (
    <div className="space-y-3">
      {selectable && selectedApplicants.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">
            {selectedApplicants.length} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setBulkOpen(true)}>
              Mark interviewed
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-secondary/40">
              <tr className="border-b border-border text-left">
                {selectable && (
                  <th className="w-10 py-3 pl-4 pr-0 align-middle">
                    <Checkbox
                      aria-label="Select all invited applicants"
                      disabled={eligibleIds.length === 0}
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                )}
                <Th>Name</Th>
                {showRole && <Th>Role</Th>}
                <Th>Submitted</Th>
                <Th>Rating</Th>
                <Th>Recommendation</Th>
                <Th>Human status</Th>
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {applicants.map((a) => {
                const role = roleById(roles, a.roleId);
                const eligible = lifecycleStage(a) === "invited";
                // A transcript is "submitted" once it has been successfully analysed.
                const transcriptIn = !!a.transcriptAnalysis && !a.transcriptAnalysis.errorFlag;
                return (
                  <tr key={a.id} className="border-b border-border transition-colors last:border-0 hover:bg-secondary/50">
                    {selectable && (
                      <td className="w-10 py-3 pl-4 pr-0 align-middle">
                        {eligible && (
                          <Checkbox
                            aria-label={`Select ${a.name}`}
                            checked={selected.has(a.id)}
                            onCheckedChange={() => toggleOne(a.id)}
                          />
                        )}
                      </td>
                    )}
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
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <StatusBadge tone={humanTone(a)}>{humanStatusLabel(a)}</StatusBadge>
                        {transcriptIn ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-teal">
                            <FileCheck className="h-3.5 w-3.5" /> Interviewed
                          </span>
                        ) : (
                          a.invited && (
                            <span className="text-xs font-medium text-success">Invited</span>
                          )
                        )}
                      </div>
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {eligible && (
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
      </div>

      {interviewFor && (
        <MarkInterviewedDialog
          applicant={interviewFor}
          open={interviewFor !== null}
          onOpenChange={(v) => !v && setInterviewFor(null)}
        />
      )}
      {selectable && (
        <BulkMarkInterviewedDialog
          applicants={selectedApplicants}
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          onDone={clearSelection}
        />
      )}
    </div>
  );
}
