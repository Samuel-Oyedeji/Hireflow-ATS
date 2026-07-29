import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDropField } from "@/components/file-drop-field";
import { actions, useAppState } from "@/lib/store";
import { prepareTranscript } from "@/lib/uploads";
import type { Applicant } from "@/lib/types";

/**
 * Bulk "mark interviewed" — upload one interview transcript per selected applicant
 * and run the AI interview analysis for each. Mirrors the single-applicant
 * MarkInterviewedDialog, but processes every applicant that has a transcript
 * attached. Applicants left without a transcript are skipped, since "interviewed"
 * requires a transcript to analyse.
 */
export function BulkMarkInterviewedDialog({
  applicants,
  open,
  onOpenChange,
  onDone,
}: {
  applicants: Applicant[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}) {
  const { currentUser } = useAppState();
  const [files, setFiles] = useState<Record<string, File>>({});
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (open) {
      setFiles({});
      setAnalyzing(false);
    }
  }, [open]);

  const ready = applicants.filter((a) => files[a.id]);

  async function submit() {
    if (ready.length === 0)
      return toast.error("Upload a transcript for at least one applicant.");

    setAnalyzing(true);
    try {
      const failed: string[] = [];
      let succeeded = 0;
      for (const a of ready) {
        try {
          const { storagePath, text } = await prepareTranscript(files[a.id], "transcripts");
          const result = await actions.analyzeTranscript(
            a.id,
            { fileName: files[a.id].name, storagePath, text },
            currentUser,
          );
          if (result?.errorFlag) failed.push(a.name);
          else succeeded += 1;
        } catch {
          failed.push(a.name);
        }
      }

      if (succeeded > 0)
        toast.success(
          `${succeeded} applicant${succeeded === 1 ? "" : "s"} marked as interviewed.`,
        );
      if (failed.length > 0)
        toast.error(`Couldn't analyse the transcript for ${failed.join(", ")}.`);

      onOpenChange(false);
      onDone?.();
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !analyzing && onOpenChange(v)}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Mark {applicants.length} applicant{applicants.length === 1 ? "" : "s"} as interviewed
          </DialogTitle>
          <DialogDescription>
            Upload each applicant's interview transcript. Saving runs the AI interview analysis
            against the role's criteria and moves them to the interviewed stage. Applicants without
            a transcript are skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4 pt-1">
          {applicants.map((a) => (
            <div key={a.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{a.name}</span>
                <span className="truncate text-xs text-muted-foreground">{a.email}</span>
              </div>
              <FileDropField
                label="Interview transcript"
                hint="PDF, DOCX, or TXT"
                accept=".pdf,.doc,.docx,.txt"
                fileName={files[a.id]?.name}
                onPick={() => {}}
                onPickFile={(f) => setFiles((prev) => ({ ...prev, [a.id]: f }))}
                onClear={() =>
                  setFiles((prev) => {
                    const next = { ...prev };
                    delete next[a.id];
                    return next;
                  })
                }
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={analyzing}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={analyzing || ready.length === 0}>
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analysing transcripts…
              </>
            ) : (
              `Mark ${ready.length} interviewed`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
