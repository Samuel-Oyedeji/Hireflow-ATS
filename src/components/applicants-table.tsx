import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Applicant, Role } from "@/lib/types";
import {
  formatDate,
  formatTime,
  lifecycleStage,
  roleById,
  workingStatus,
} from "@/lib/hireflow";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge, Dot, aiDecisionTone, type Tone } from "@/components/status-badge";
import { MarkInterviewedDialog } from "@/components/mark-interviewed-dialog";
import { BulkMarkInterviewedDialog } from "@/components/bulk-mark-interviewed-dialog";

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("h-14 px-5 align-middle", className)}>{children}</td>;
}

// The review status reflects the human's decision only — an override reads the
// same as any other accept/reject, so there is no separate "overridden" state.
function reviewTone(a: Applicant): Tone {
  const s = workingStatus(a);
  return s === "advanced" ? "success" : s === "rejected" ? "danger" : "warning";
}
function reviewLabel(a: Applicant): string {
  const s = workingStatus(a);
  return s === "advanced" ? "Accepted" : s === "rejected" ? "Rejected" : "Awaiting review";
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
  const navigate = useNavigate();
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
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-accent/70 px-4 py-2.5 shadow-[var(--shadow-sm)]">
          <span className="text-sm font-medium text-accent-foreground">
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

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="overflow-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="border-b border-border bg-[var(--surface-muted)]">
              <tr className="text-left">
                {selectable && (
                  <th className="w-10 py-3 pl-5 pr-0 align-middle">
                    <Checkbox
                      aria-label="Select all invited applicants"
                      disabled={eligibleIds.length === 0}
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                )}
                <Th className="w-[220px]">Name</Th>
                {showRole && <Th className="w-[250px]">Role</Th>}
                <Th className="w-[96px]">Rating</Th>
                <Th className="w-[170px]">Review</Th>
                <Th className="w-[150px] text-right" />
                <Th className="w-[120px] text-right">Submitted</Th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((a) => {
                const role = roleById(roles, a.roleId);
                const eligible = lifecycleStage(a) === "invited";
                // A transcript is "submitted" once it has been successfully analysed.
                const transcriptIn = !!a.transcriptAnalysis && !a.transcriptAnalysis.errorFlag;
                return (
                  <tr
                    key={a.id}
                    onClick={() =>
                      navigate({ to: "/applicants/$applicantId", params: { applicantId: a.id } })
                    }
                    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-accent/50"
                  >
                    {selectable && (
                      <td
                        className="w-10 py-3 pl-5 pr-0 align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                        title={a.name}
                        className="block truncate font-medium text-foreground hover:text-primary"
                      >
                        {a.name}
                      </Link>
                      <div className="truncate text-xs text-muted-foreground" title={a.email}>
                        {a.email}
                      </div>
                    </Td>
                    {showRole && (
                      <Td>
                        <span
                          className="inline-block max-w-full truncate rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                          title={role?.title ?? undefined}
                        >
                          {role?.title ?? "—"}
                        </span>
                      </Td>
                    )}
                    <Td>
                      <span className="inline-flex items-center gap-2 font-medium tabular-nums text-foreground">
                        <Dot tone={aiDecisionTone(a.aiDecision)} />
                        {a.aiScore}/100
                      </span>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <StatusBadge tone={reviewTone(a)}>{reviewLabel(a)}</StatusBadge>
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInterviewFor(a);
                            }}
                          >
                            Mark interviewed
                          </Button>
                        )}
                      </div>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <div className="text-xs font-medium text-foreground">
                        {formatDate(a.submittedDate)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatTime(a.submittedDate)}
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
