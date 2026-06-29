import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  Minus,
  Users,
  X,
} from "lucide-react";

import { PageHeader, PageBody } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge, aiDecisionTone, type Tone } from "@/components/status-badge";
import { ScoreRing } from "@/components/score-ring";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { actions, useAppState } from "@/lib/store";
import { formatDate, weightLabel } from "@/lib/hireflow";
import type { CriterionMatch, HumanDecision } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/applicants/$applicantId")({
  head: () => ({ meta: [{ title: "Applicant review — HireFlow" }] }),
  component: ApplicantReviewPage,
});

const matchIcon: Record<CriterionMatch, { icon: typeof Check; tone: Tone; label: string }> = {
  met: { icon: Check, tone: "success", label: "Met" },
  "not-met": { icon: X, tone: "danger", label: "Not met" },
  partial: { icon: Minus, tone: "warning", label: "Partial" },
};

function ApplicantReviewPage() {
  const { applicantId } = Route.useParams();
  const { applicants, roles, currentUser } = useAppState();
  const applicant = applicants.find((a) => a.id === applicantId);
  const role = roles.find((r) => r.id === applicant?.roleId);

  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<HumanDecision>(null);
  const [reason, setReason] = useState("");

  if (!applicant) {
    return (
      <>
        <PageHeader title="Applicant not found" />
        <PageBody>
          <EmptyState
            icon={Users}
            title="This applicant doesn't exist"
            description="It may have been removed."
            action={
              <Button asChild variant="outline">
                <Link to="/applicants">Back to applicants</Link>
              </Button>
            }
          />
        </PageBody>
      </>
    );
  }

  const aiTone = aiDecisionTone(applicant.aiDecision);
  const aiLabel = applicant.aiDecision === "advanced" ? "Advanced" : "Rejected";
  const decided = applicant.humanDecision !== null;
  const showForm = !decided || editing;

  const suggested: HumanDecision = applicant.aiDecision === "advanced" ? "advance" : "reject";
  const isOverride = choice !== null && choice !== suggested;

  const statusTone: Tone = decided
    ? applicant.humanDecision === "advance"
      ? "success"
      : "danger"
    : "warning";
  const statusLabel = decided
    ? applicant.humanDecision === "advance"
      ? "Advanced"
      : "Rejected"
    : "Pending review";

  function startEdit() {
    setChoice(applicant!.humanDecision);
    setReason(applicant!.overrideReason ?? "");
    setEditing(true);
  }

  function save() {
    if (!choice) return toast.error("Select a decision first.");
    if (isOverride && !reason.trim())
      return toast.error("Add a reason for overriding the AI decision.");
    actions.saveDecision(applicant!.id, choice, isOverride ? reason.trim() : "", currentUser);
    setEditing(false);
    toast.success(`Marked as ${choice === "advance" ? "advanced" : "rejected"}.`);
  }

  return (
    <>
      <PageHeader
        title={applicant.name}
        back={
          <Link
            to="/applicants"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Applicants
          </Link>
        }
        description={
          <span>
            {role ? (
              <Link to="/roles/$roleId" params={{ roleId: role.id }} className="hover:text-foreground">
                {role.title}
              </Link>
            ) : (
              "Unknown role"
            )}
            <span className="text-border"> · </span>
            Submitted {formatDate(applicant.submittedDate)}
          </span>
        }
        action={<StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>}
      />
      <PageBody className="space-y-6">
        {/* Confirmation banner */}
        {decided && (
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm",
              statusTone === "success"
                ? "border-success/25 bg-success-muted text-success"
                : "border-danger/25 bg-danger-muted text-danger",
            )}
          >
            <span className="font-medium">
              Marked as {applicant.humanDecision === "advance" ? "advanced" : "rejected"} by{" "}
              {applicant.decidedBy} on {formatDate(applicant.decidedDate)}
              {applicant.invited && " · Interview invite sent"}
            </span>
            {!editing && (
              <button onClick={startEdit} className="font-medium underline underline-offset-2">
                Change decision
              </button>
            )}
          </div>
        )}

        {/* AI Screening Result */}
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-3 sm:w-44">
              <ScoreRing score={applicant.aiScore} tone={aiTone} />
              <StatusBadge tone={aiTone} dot>
                AI: {aiLabel}
              </StatusBadge>
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  AI screening result
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{applicant.reasoning}</p>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Criteria breakdown
                </h3>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {applicant.criteriaResults.map((res) => {
                    const crit = role?.criteria.find((c) => c.id === res.criterionId);
                    const m = matchIcon[res.match];
                    const Icon = m.icon;
                    return (
                      <li key={res.criterionId} className="flex items-start gap-3 px-3 py-2.5">
                        <span
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                            m.tone === "success" && "bg-success-muted text-success",
                            m.tone === "danger" && "bg-danger-muted text-danger",
                            m.tone === "warning" && "bg-warning-muted text-warning",
                          )}
                        >
                          <Icon className="h-3 w-3" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {crit?.label ?? "Criterion"}
                            </span>
                            {crit && (
                              <span className="text-xs text-muted-foreground">
                                {weightLabel[crit.weight]}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{res.note}</p>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Documents */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Documents</h2>
          <Accordion type="single" collapsible className="w-full">
            {applicant.documents.map((doc, i) => (
              <AccordionItem key={i} value={`doc-${i}`}>
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {doc.name}
                    <span className="font-normal text-muted-foreground">· {doc.fileName}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-secondary/30 px-4 py-8 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Inline preview is not available in this demo.
                    </p>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" /> Download {doc.fileName}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Human decision */}
        {showForm && (
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Human decision</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review the AI's reasoning, then confirm or override the decision.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DecisionButton
                active={choice === "advance"}
                suggested={suggested === "advance"}
                tone="success"
                label="Confirm: advance"
                onClick={() => setChoice("advance")}
              />
              <DecisionButton
                active={choice === "reject"}
                suggested={suggested === "reject"}
                tone="danger"
                label="Confirm: reject"
                onClick={() => setChoice("reject")}
              />
            </div>

            {isOverride && (
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="override">Reason for override</Label>
                <Textarea
                  id="override"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why are you changing this decision? (helps improve future screening)"
                  rows={3}
                />
              </div>
            )}

            <div className="mt-5 flex items-center gap-2">
              <Button onClick={save}>Save decision</Button>
              {editing && (
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </section>
        )}
      </PageBody>
    </>
  );
}

function DecisionButton({
  active,
  suggested,
  tone,
  label,
  onClick,
}: {
  active: boolean;
  suggested: boolean;
  tone: "success" | "danger";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-colors",
        active
          ? tone === "success"
            ? "border-success bg-success-muted text-success ring-1 ring-success"
            : "border-danger bg-danger-muted text-danger ring-1 ring-danger"
          : "border-border bg-card text-foreground hover:bg-secondary/50",
      )}
    >
      {tone === "success" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      {label}
      {suggested && !active && (
        <span className="absolute right-3 text-xs font-normal text-muted-foreground">Suggested</span>
      )}
    </button>
  );
}