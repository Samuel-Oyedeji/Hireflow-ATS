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
  const [fileName, setFileName] = useState<string | undefined>();
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (open) {
      setFileName(undefined);
      setAnalyzing(false);
    }
  }, [open]);

  function submit() {
    if (!fileName) return toast.error("Upload the interview transcript to analyse it.");
    setAnalyzing(true);
    // Simulated analysis latency, matching the screening and upload flows.
    setTimeout(() => {
      const result = actions.analyzeTranscript(applicant.id, { fileName }, currentUser);
      setAnalyzing(false);
      if (result?.errorFlag) {
        toast.error(result.errorReason ?? "Couldn't analyse that transcript.");
        return;
      }
      onOpenChange(false);
      toast.success(`${applicant.name} marked as interviewed.`);
      navigate({ to: "/applicants/$applicantId", params: { applicantId: applicant.id } });
    }, 1400);
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
          fileName={fileName}
          onPick={setFileName}
          onClear={() => setFileName(undefined)}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={analyzing}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={analyzing || !fileName}>
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
