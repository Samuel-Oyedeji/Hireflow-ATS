import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  FileText,
  Minus,
  Plus,
  Scale,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { PageHeader, PageBody } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  StatusBadge,
  aiDecisionTone,
  type Tone,
} from "@/components/status-badge";
import { ScoreRing } from "@/components/score-ring";
import { InterviewSection } from "@/components/interview-section";
import { AddDocumentsDialog } from "@/components/add-documents-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { actions, useAppState } from "@/lib/store";
import { formatDate, weightLabel } from "@/lib/hireflow";
import type { CriterionMatch, HumanDecision } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/applicants/$applicantId")({
  head: () => ({ meta: [{ title: "Applicant review — HireFlow" }] }),
  component: ApplicantReviewPage,
});

const matchIcon: Record<
  CriterionMatch,
  { icon: typeof Check; tone: Tone; label: string }
> = {
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
  const [addDocsOpen, setAddDocsOpen] = useState(false);

  const hasTranscript = !!applicant?.transcript;
  const [tab, setTab] = useState<"assessment" | "interviewed">(
    hasTranscript ? "interviewed" : "assessment",
  );
  // Once a transcript is uploaded, redirect to (and default to) the Interviewed tab.
  useEffect(() => {
    if (hasTranscript) setTab("interviewed");
  }, [hasTranscript]);

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

  const suggested: HumanDecision =
    applicant.aiDecision === "advanced" ? "advance" : "reject";
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
    actions.saveDecision(
      applicant!.id,
      choice,
      isOverride ? reason.trim() : "",
      currentUser,
    );
    setEditing(false);
    toast.success(
      `Marked as ${choice === "advance" ? "advanced" : "rejected"}.`,
    );
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
              <Link
                to="/roles/$roleId"
                params={{ roleId: role.id }}
                className="hover:text-foreground"
              >
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
      <PageBody>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "assessment" | "interviewed")}
        >
          <TabsList>
            <TabsTrigger value="assessment">Assessment</TabsTrigger>
            {hasTranscript && (
              <TabsTrigger value="interviewed">Interviewed</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="assessment" className="space-y-6">
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
                  Marked as{" "}
                  {applicant.humanDecision === "advance"
                    ? "advanced"
                    : "rejected"}{" "}
                  by {applicant.decidedBy} on{" "}
                  {formatDate(applicant.decidedDate)}
                  {applicant.invited && " · Interview invite sent"}
                </span>
                {!editing && (
                  <button
                    onClick={startEdit}
                    className="font-medium underline underline-offset-2"
                  >
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
                    <p className="mt-2 text-sm leading-relaxed text-foreground">
                      {applicant.reasoning}
                    </p>
                  </div>

                  <div>
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Criteria breakdown
                    </h3>
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {applicant.criteriaResults.map((res) => {
                        const crit = role?.criteria.find(
                          (c) => c.id === res.criterionId,
                        );
                        const m = matchIcon[res.match];
                        const Icon = m.icon;
                        return (
                          <li
                            key={res.criterionId}
                            className="flex items-start gap-3 px-3 py-2.5"
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                                m.tone === "success" &&
                                  "bg-success-muted text-success",
                                m.tone === "danger" &&
                                  "bg-danger-muted text-danger",
                                m.tone === "warning" &&
                                  "bg-warning-muted text-warning",
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
                              <p className="text-xs text-muted-foreground">
                                {res.note}
                              </p>
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                              {m.label}
                            </span>
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
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Documents
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddDocsOpen(true)}
                >
                  <Plus className="h-4 w-4" /> Add documents
                </Button>
              </div>
              {applicant.documents.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No documents on file. Add documents to run AI screening.
                </p>
              )}
              <Accordion type="single" collapsible className="w-full">
                {applicant.documents.map((doc, i) => (
                  <AccordionItem key={i} value={`doc-${i}`}>
                    <AccordionTrigger className="text-sm">
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        {doc.name}
                        <span className="font-normal text-muted-foreground">
                          · {doc.fileName}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-secondary/30 px-4 py-8 text-center">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Inline preview is not available in this demo.
                        </p>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4" /> Download{" "}
                          {doc.fileName}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>

            {/* Interview transcript upload — shown here until a transcript exists,
            after which the analysis lives on the Interviewed tab. */}
            {applicant.invited && !hasTranscript && (
              <InterviewSection
                applicant={applicant}
                role={role}
                currentUser={currentUser}
              />
            )}

            {/* Human decision */}
            {showForm && (
              <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
                <div className="flex flex-col gap-3 border-b border-border bg-[var(--surface-muted)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary ring-1 ring-primary/10">
                      <Scale className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-foreground">
                        Human decision
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Confirm the AI's recommendation, or override it with a
                        reason.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-[var(--shadow-sm)] sm:self-auto">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    AI suggests
                    <span
                      className={cn(
                        "font-semibold",
                        suggested === "advance" ? "text-success" : "text-danger",
                      )}
                    >
                      {suggested === "advance" ? "Advance" : "Reject"}
                    </span>
                  </span>
                </div>

                <div className="p-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DecisionButton
                      active={choice === "advance"}
                      suggested={suggested === "advance"}
                      tone="success"
                      label="Advance"
                      hint="Move forward to interview"
                      onClick={() => setChoice("advance")}
                    />
                    <DecisionButton
                      active={choice === "reject"}
                      suggested={suggested === "reject"}
                      tone="danger"
                      label="Reject"
                      hint="Do not proceed with this applicant"
                      onClick={() => setChoice("reject")}
                    />
                  </div>

                  {isOverride && (
                    <div className="mt-4 rounded-xl border border-warning/30 bg-warning-muted p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                        <Label
                          htmlFor="override"
                          className="text-sm font-semibold text-warning"
                        >
                          You're overriding the AI recommendation
                        </Label>
                      </div>
                      <p className="mt-1 pl-6 text-xs text-muted-foreground">
                        Add a short reason — this helps improve future screening.
                      </p>
                      <Textarea
                        id="override"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why are you changing this decision?"
                        rows={3}
                        className="mt-3 bg-card"
                      />
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Button onClick={save} disabled={!choice}>
                        Save decision
                      </Button>
                      {editing && (
                        <Button variant="ghost" onClick={() => setEditing(false)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                    {!choice && (
                      <span className="text-xs text-muted-foreground">
                        Select a decision to continue
                      </span>
                    )}
                  </div>
                </div>
              </section>
            )}
          </TabsContent>

          {hasTranscript && (
            <TabsContent value="interviewed">
              <InterviewSection
                applicant={applicant}
                role={role}
                currentUser={currentUser}
              />
            </TabsContent>
          )}
        </Tabs>
      </PageBody>

      <AddDocumentsDialog
        applicantId={applicant.id}
        open={addDocsOpen}
        onOpenChange={setAddDocsOpen}
      />
    </>
  );
}

function DecisionButton({
  active,
  suggested,
  tone,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  suggested: boolean;
  tone: "success" | "danger";
  label: string;
  hint: string;
  onClick: () => void;
}) {
  const Icon = tone === "success" ? Check : X;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.99]",
        active
          ? tone === "success"
            ? "border-success bg-success-muted ring-1 ring-success/40"
            : "border-danger bg-danger-muted ring-1 ring-danger/40"
          : "border-border bg-card hover:-translate-y-px hover:border-primary/30 hover:bg-accent/40 hover:shadow-[var(--shadow-sm)]",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
          active
            ? tone === "success"
              ? "bg-success text-success-foreground"
              : "bg-danger text-danger-foreground"
            : tone === "success"
              ? "bg-success-muted text-success"
              : "bg-danger-muted text-danger",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-semibold",
              active
                ? tone === "success"
                  ? "text-success"
                  : "text-danger"
                : "text-foreground",
            )}
          >
            {label}
          </span>
          {suggested && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Suggested
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {hint}
        </span>
      </span>
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          active
            ? tone === "success"
              ? "border-success bg-success text-success-foreground"
              : "border-danger bg-danger text-danger-foreground"
            : "border-border text-transparent group-hover:border-primary/40",
        )}
      >
        <Check className="h-3 w-3" />
      </span>
    </button>
  );
}
