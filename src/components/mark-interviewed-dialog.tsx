import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (open) {
      setFile(undefined);
      setAnalyzing(false);
    }
  }, [open]);

  async function submit() {
    if (!file) return toast.error("Upload the interview transcript to analyse it.");
    setAnalyzing(true);
    try {
      const { storagePath, text } = await prepareTranscript(file, "transcripts");
      const result = await actions.analyzeTranscript(
        applicant.id,
        { fileName: file.name, storagePath, text },
        currentUser,
      );
      if (result?.errorFlag) {
        toast.error(result.errorReason ?? "Couldn't analyse that transcript.");
        return;
      }
      onOpenChange(false);
      toast.success(`${applicant.name} marked as interviewed.`);
      navigate({ to: "/applicants/$applicantId", params: { applicantId: applicant.id } });
    } catch {
      toast.error("Couldn't analyse that transcript. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !analyzing && onOpenChange(v)}>
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
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={analyzing}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={analyzing || !file}>
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analysing transcript…
              </>
            ) : (
              "Mark as interviewed"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
