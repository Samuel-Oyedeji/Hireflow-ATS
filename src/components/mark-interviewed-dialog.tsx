import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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

export function MarkInterviewedDialog({
  applicant,
  open,
  onOpenChange,
}: {
  applicant: Applicant;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { currentUser } = useAppState();
  const [file, setFile] = useState<File | undefined>();

  useEffect(() => {
    if (open) setFile(undefined);
  }, [open]);

  function submit() {
    if (!file) return toast.error("Upload the interview transcript to analyse it.");

    // Capture the file, close the dialog, and run in the background behind a toast so
    // the user isn't stuck waiting. A failed run persists nothing (server rolls back),
    // so the applicant stays in its previous, pre-interview state.
    const chosen = file;
    onOpenChange(false);

    const run = (async () => {
      const { storagePath, text } = await prepareTranscript(chosen, "transcripts");
      const result = await actions.analyzeTranscript(
        applicant.id,
        { fileName: chosen.name, storagePath, text },
        currentUser,
      );
      if (result?.errorFlag) {
        throw new Error(result.errorReason ?? "Couldn't analyse that transcript.");
      }
    })();

    toast.promise(run, {
      loading: `Analysing ${applicant.name}'s transcript…`,
      success: `${applicant.name} marked as interviewed.`,
      error: (err) =>
        err instanceof Error && err.message
          ? err.message
          : "Couldn't analyse that transcript. Please try again.",
    });

    run
      .then(() =>
        navigate({ to: "/applicants/$applicantId", params: { applicantId: applicant.id } }),
      )
      .catch(() => {});
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Mark {applicant.name} as interviewed</DialogTitle>
          <DialogDescription>
            Upload the interview transcript. Saving runs the AI interview analysis against the role's
            criteria and moves this applicant to the interviewed stage.
          </DialogDescription>
        </DialogHeader>

        <FileDropField
          label="Interview transcript (PDF, DOCX, or TXT)"
          hint="PDF, DOCX, or TXT"
          accept=".pdf,.doc,.docx,.txt"
          fileName={file?.name}
          onPick={() => {}}
          onPickFile={setFile}
          onClear={() => setFile(undefined)}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!file}>
            Mark as interviewed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
