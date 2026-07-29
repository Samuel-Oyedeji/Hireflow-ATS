import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, Lightbulb, Loader2, Minus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, type Tone } from "@/components/status-badge";
import { FileDropField } from "@/components/file-drop-field";
import { cn } from "@/lib/utils";
import { actions } from "@/lib/store";
import { prepareTranscript } from "@/lib/uploads";
import { formatDate, lifecycleStage, lifecycleStageLabel } from "@/lib/hireflow";
import type {
  Applicant,
  Assessment,
  Confidence,
  Role,
  TranscriptAnalysis,
  TranscriptSuggestion,
  TranscriptUpload,
} from "@/lib/types";

const suggestionDisplay: Record<TranscriptSuggestion, { label: string; tone: Tone }> = {
  hire: { label: "Recommend hire", tone: "success" },
  further_review: { label: "Further review needed", tone: "warning" },
  reject: { label: "Do not recommend", tone: "danger" },
};

const confidenceLabel: Record<Confidence, string> = { high: "High", medium: "Medium", low: "Low" };
const assessmentLabel: Record<Assessment, string> = {
  met: "Met",
  not_met: "Not met",
  unclear: "Unclear",
};
const assessmentIcon: Record<
  Assessment,
  { icon: typeof Check; tone: "success" | "danger" | "warning" }
> = {
  met: { icon: Check, tone: "success" },
  not_met: { icon: X, tone: "danger" },
  unclear: { icon: Minus, tone: "warning" },
};
const toneBg: Record<"success" | "danger" | "warning", string> = {
  success: "bg-success-muted text-success",
  danger: "bg-danger-muted text-danger",
  warning: "bg-warning-muted text-warning",
};

const finalOptions: {
  value: TranscriptSuggestion;
  label: string;
  tone: "success" | "warning" | "danger";
}[] = [
  { value: "hire", label: "Proceed to hire", tone: "success" },
  { value: "further_review", label: "Hold / further review", tone: "warning" },
  { value: "reject", label: "Reject", tone: "danger" },
];
const finalLabel: Record<TranscriptSuggestion, string> = {
  hire: "Proceed to hire",
  further_review: "Hold / further review",
  reject: "Reject",
};
const bannerTone: Record<TranscriptSuggestion, string> = {
  hire: "border-success/25 bg-success-muted text-success",
  further_review: "border-warning/25 bg-warning-muted text-warning",
  reject: "border-danger/25 bg-danger-muted text-danger",
};

export function InterviewSection({
  applicant,
  role,
  currentUser,
}: {
  applicant: Applicant;
  role?: Role;
  currentUser: string;
}) {
  const [file, setFile] = useState<File | undefined>();
  const [analyzing, setAnalyzing] = useState(false);
  const analysis = applicant.transcriptAnalysis;
  const hasValidAnalysis = !!analysis && !analysis.errorFlag;

  async function analyse() {
    if (!file) return toast.error("Upload a transcript first.");
    setAnalyzing(true);
    try {
      const { storagePath, text } = await prepareTranscript(file, "transcripts");
      const result = await actions.analyzeTranscript(
        applicant.id,
        { fileName: file.name, storagePath, text },
        currentUser,
      );
      setFile(undefined);
      if (result?.errorFlag) toast.error(result.errorReason ?? "Couldn't analyse that transcript.");
    } catch {
      toast.error("Couldn't analyse that transcript. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <section className="rounded-lg border border-border border-l-4 border-l-teal bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-teal">Interview</h2>
        <StatusBadge tone="neutral">{lifecycleStageLabel[lifecycleStage(applicant)]}</StatusBadge>
      </div>

      {analyzing ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Analysing transcript…
        </div>
      ) : hasValidAnalysis ? (
        <>
          <AnalysisCard analysis={analysis} role={role} transcript={applicant.transcript} />
          <FinalDecisionBlock applicant={applicant} currentUser={currentUser} />
        </>
      ) : (
        <div className="space-y-3">
          {analysis?.errorFlag && (
            <div className="flex items-start gap-2 rounded-md border border-danger/25 bg-danger-muted px-3 py-2 text-sm text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{analysis.errorReason}</span>
            </div>
          )}
          <FileDropField
            label="Upload interview transcript (PDF, DOCX, or TXT)"
            hint="PDF, DOCX, or TXT"
            accept=".pdf,.doc,.docx,.txt"
            fileName={file?.name}
            onPick={() => {}}
            onPickFile={setFile}
            onClear={() => setFile(undefined)}
          />
          <Button onClick={analyse} disabled={!file}>
            Analyse transcript
          </Button>
        </div>
      )}
    </section>
  );
}

function AnalysisCard({
  analysis,
  role,
  transcript,
}: {
  analysis: TranscriptAnalysis;
  role?: Role;
  transcript?: TranscriptUpload;
}) {
  const s = suggestionDisplay[analysis.overallSuggestion];
  return (
    <div className="space-y-5">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-teal">
          Interview analysis
        </span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge tone={s.tone} dot>
            {s.label}
          </StatusBadge>
          <StatusBadge tone="neutral">
            {confidenceLabel[analysis.confidence]} confidence
          </StatusBadge>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-foreground">{analysis.summary}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <BulletList title="Strengths" tone="success" items={analysis.strengths} />
        <BulletList title="Concerns" tone="danger" items={analysis.concerns} />
      </div>

      {analysis.criteriaUpdate.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Criteria update
          </h3>
          <ul className="divide-y divide-border rounded-md border border-border">
            {analysis.criteriaUpdate.map((u) => {
              const crit = role?.criteria.find((c) => c.id === u.criterionId);
              const changed = u.originalAssessment !== u.updatedAssessment;
              const m = assessmentIcon[u.updatedAssessment];
              const Icon = m.icon;
              return (
                <li key={u.criterionId} className="flex items-start gap-3 px-3 py-2.5">
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      toneBg[m.tone],
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {crit?.label ?? "Criterion"}
                      </span>
                      {changed ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {assessmentLabel[u.originalAssessment]}
                          <ArrowRight className="h-3 w-3" />
                          <span className="font-medium text-foreground">
                            {assessmentLabel[u.updatedAssessment]}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {assessmentLabel[u.updatedAssessment]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{u.note}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-md border border-teal/25 bg-teal-muted px-4 py-3">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal">
            Suggested next step
          </p>
          <p className="mt-0.5 text-sm text-foreground">{analysis.suggestedNextStep}</p>
        </div>
      </div>

      {transcript && (
        <p className="text-xs text-muted-foreground">
          Analysed from {transcript.fileName} · uploaded by {transcript.uploadedBy}
        </p>
      )}
    </div>
  );
}

function BulletList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "success" | "danger";
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3
        className={cn(
          "mb-1.5 text-xs font-medium uppercase tracking-wide",
          tone === "success" ? "text-success" : "text-danger",
        )}
      >
        {title}
      </h3>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <span
              className={cn(
                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                tone === "success" ? "bg-success" : "bg-danger",
              )}
            />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FinalDecisionBlock({
  applicant,
  currentUser,
}: {
  applicant: Applicant;
  currentUser: string;
}) {
  const analysis = applicant.transcriptAnalysis!;
  const existing = applicant.finalDecision;
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<TranscriptSuggestion | null>(existing?.decision ?? null);
  const [reason, setReason] = useState(existing?.overrideReason ?? "");
  const [saving, setSaving] = useState(false);

  const decided = !!existing;
  const showForm = !decided || editing;
  const isOverride = choice !== null && choice !== analysis.overallSuggestion;

  function startEdit() {
    setChoice(existing!.decision);
    setReason(existing!.overrideReason ?? "");
    setEditing(true);
  }

  async function save() {
    if (!choice) return toast.error("Select a final decision.");
    setSaving(true);
    try {
      await actions.saveFinalDecision(
        applicant.id,
        choice,
        isOverride ? reason.trim() : "",
        currentUser,
      );
      setEditing(false);
      toast.success("Final decision saved.");
    } catch {
      toast.error("Couldn't save the final decision. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 border-t border-border pt-5">
      <h3 className="text-sm font-semibold text-foreground">Final decision</h3>

      {decided && !editing && existing && (
        <div
          className={cn(
            "mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm",
            bannerTone[existing.decision],
          )}
        >
          <span className="font-medium">
            {finalLabel[existing.decision]} — by {existing.decidedBy} on{" "}
            {formatDate(existing.createdAt)}
            {existing.isOverride && " · overrides AI suggestion"}
          </span>
          <button onClick={startEdit} className="font-medium underline underline-offset-2">
            Change decision
          </button>
        </div>
      )}

      {showForm && (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirm the AI suggestion or choose a different outcome.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {finalOptions.map((opt) => (
              <FinalDecisionButton
                key={opt.value}
                active={choice === opt.value}
                suggested={analysis.overallSuggestion === opt.value}
                tone={opt.tone}
                label={opt.label}
                onClick={() => setChoice(opt.value)}
              />
            ))}
          </div>

          {isOverride && (
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="final-override">Reason for override (optional)</Label>
              <Textarea
                id="final-override"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you deciding differently from the AI suggestion?"
                rows={3}
              />
            </div>
          )}

          <div className="mt-5 flex items-center gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save final decision"
              )}
            </Button>
            {editing && (
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const activeClasses: Record<"success" | "warning" | "danger", string> = {
  success: "border-success bg-success-muted text-success ring-1 ring-success",
  warning: "border-warning bg-warning-muted text-warning ring-1 ring-warning",
  danger: "border-danger bg-danger-muted text-danger ring-1 ring-danger",
};

function FinalDecisionButton({
  active,
  suggested,
  tone,
  label,
  onClick,
}: {
  active: boolean;
  suggested: boolean;
  tone: "success" | "warning" | "danger";
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
          ? activeClasses[tone]
          : "border-border bg-card text-foreground hover:bg-secondary/50",
      )}
    >
      {label}
      {suggested && !active && (
        <span className="absolute right-2 top-1 text-[10px] font-normal text-muted-foreground">
          Suggested
        </span>
      )}
    </button>
  );
}
