import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Check,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { documentUrlFn } from "@/lib/data";
import { actions, useAppState } from "@/lib/store";
import { formatDate, weightLabel } from "@/lib/hireflow";
import type {
  ApplicantDocument,
  CriterionMatch,
  HumanDecision,
} from "@/lib/types";
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
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [addDocsOpen, setAddDocsOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ApplicantDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);

  // Resolve a time-limited inline URL for the doc being previewed. The bucket is
  // private, so this round-trips to the server for a signed URL each open.
  useEffect(() => {
    setPreviewUrl(null);
    setPreviewError(false);
    const path = previewDoc?.storagePath;
    if (!path) return;
    let active = true;
    documentUrlFn({ data: { storagePath: path } })
      .then(({ url }) => active && setPreviewUrl(url))
      .catch(() => active && setPreviewError(true));
    return () => {
      active = false;
    };
  }, [previewDoc?.storagePath]);

  async function downloadDoc(doc: ApplicantDocument) {
    if (!doc.storagePath) return;
    try {
      const { url } = await documentUrlFn({
        data: { storagePath: doc.storagePath, downloadName: doc.fileName },
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      a.click();
    } catch {
      toast.error("Couldn't prepare the download. Please try again.");
    }
  }

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

  async function save() {
    if (!choice) return toast.error("Select a decision first.");
    setSaving(true);
    try {
      await actions.saveDecision(
        applicant!.id,
        choice,
        isOverride ? reason.trim() : "",
        currentUser,
      );
      setEditing(false);
      toast.success(
        `Marked as ${choice === "advance" ? "advanced" : "rejected"}.`,
      );
    } catch {
      toast.error("Couldn't save the decision. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function reanalyze() {
    setReanalyzing(true);
    try {
      // Only overwrites the existing assessment if a fresh result comes back; a
      // failed or timed-out request throws and leaves the prior result intact.
      await actions.rescreenApplicant(applicant!.id);
      toast.success("Re-analysis complete.");
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't re-analyze. The previous result was kept.",
      );
    } finally {
      setReanalyzing(false);
    }
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

            {/* Human decision — kept at the top so the page's primary action
            is visible on first look, with the assessment detail below it. */}
            {showForm && (
              <section className="rounded-lg border border-border bg-card px-3.5 py-1.5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="font-medium text-foreground">Your decision</span>
                    <span className="text-border">·</span>
                    AI recommends{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        suggested === "advance"
                          ? "text-success"
                          : "text-danger",
                      )}
                    >
                      {suggested === "advance" ? "Advance" : "Reject"}
                    </span>
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <DecisionOption
                      active={choice === "advance"}
                      recommended={suggested === "advance"}
                      tone="success"
                      label="Advance"
                      onClick={() => setChoice("advance")}
                    />
                    <DecisionOption
                      active={choice === "reject"}
                      recommended={suggested === "reject"}
                      tone="danger"
                      label="Reject"
                      onClick={() => setChoice("reject")}
                    />
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={save}
                      disabled={!choice || saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                        </>
                      ) : (
                        "Save"
                      )}
                    </Button>
                    {editing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 text-xs"
                        onClick={() => setEditing(false)}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                {isOverride && (
                  <div className="mt-4 border-t border-border pt-4">
                    <Label
                      htmlFor="override"
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                      Overriding the AI — add a note (optional)
                    </Label>
                    <Textarea
                      id="override"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Why are you changing this decision?"
                      rows={2}
                      className="mt-2 bg-card"
                    />
                  </div>
                )}
              </section>
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
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                        AI screening result
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={reanalyze}
                        disabled={reanalyzing}
                      >
                        {reanalyzing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" /> Re-analyze
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">
                      {applicant.reasoning}
                    </p>
                  </div>

                  {(applicant.education.length > 0 ||
                    applicant.workHistory.length > 0) && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ExtractedList
                        icon={GraduationCap}
                        title="Education"
                        items={applicant.education}
                      />
                      <ExtractedList
                        icon={Briefcase}
                        title="Work history"
                        items={applicant.workHistory}
                      />
                    </div>
                  )}

                  <div>
                    <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
              <ul className="flex flex-col divide-y divide-border">
                {applicant.documents.map((doc, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate font-medium text-foreground">
                        {doc.name}
                      </span>
                      <span className="truncate font-normal text-muted-foreground">
                        · {doc.fileName}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewDoc(doc)}
                      >
                        <Eye className="h-4 w-4" /> Preview
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Download ${doc.fileName}`}
                        disabled={!doc.storagePath}
                        onClick={() => downloadDoc(doc)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
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

      <Sheet
        open={previewDoc !== null}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        >
          <SheetHeader className="flex-row items-center justify-between gap-3 border-b border-border p-5 text-left">
            <div className="min-w-0">
              <SheetTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{previewDoc?.name}</span>
              </SheetTitle>
              <SheetDescription className="truncate">
                {previewDoc?.fileName}
              </SheetDescription>
            </div>
            {previewDoc && (
              <Button
                variant="outline"
                size="sm"
                className="mr-8 shrink-0"
                disabled={!previewDoc.storagePath}
                onClick={() => downloadDoc(previewDoc)}
              >
                <Download className="h-4 w-4" /> Download
              </Button>
            )}
          </SheetHeader>

          {!previewDoc?.storagePath ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No stored file for this document.
              </p>
            </div>
          ) : previewError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Couldn't load a preview. Try downloading the file instead.
              </p>
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              title={`Preview of ${previewDoc.fileName}`}
              className="h-full w-full flex-1 border-0 bg-muted"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ExtractedList({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Check;
  title: string;
  items: string[];
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Not stated in the documents.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DecisionOption({
  active,
  recommended,
  tone,
  label,
  onClick,
}: {
  active: boolean;
  recommended: boolean;
  tone: "success" | "danger";
  label: string;
  onClick: () => void;
}) {
  const Icon = tone === "success" ? Check : X;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.98]",
        active
          ? tone === "success"
            ? "border-success bg-success-muted text-success ring-1 ring-success/40"
            : "border-danger bg-danger-muted text-danger ring-1 ring-danger/40"
          : recommended
            ? "border-primary/40 bg-card text-foreground ring-2 ring-primary/15 hover:-translate-y-px hover:shadow-[var(--shadow-sm)]"
            : "border-border bg-card text-foreground hover:-translate-y-px hover:border-primary/30 hover:bg-accent/40 hover:shadow-[var(--shadow-sm)]",
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          active ? "" : tone === "success" ? "text-success" : "text-danger",
        )}
      />
      {label}
      {recommended && !active && (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
          AI pick
        </span>
      )}
    </button>
  );
}
