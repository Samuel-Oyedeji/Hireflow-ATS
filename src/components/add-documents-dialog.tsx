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
import { actions } from "@/lib/store";
import type { ApplicantDocument } from "@/lib/types";

type Slot = { type: ApplicantDocument["type"]; label: string };
const slots: Slot[] = [
  { type: "resume", label: "Resume / CV" },
  { type: "cover-letter", label: "Cover letter" },
  { type: "other", label: "Other supporting document" },
];

export function AddDocumentsDialog({
  applicantId,
  open,
  onOpenChange,
}: {
  applicantId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [screening, setScreening] = useState(false);

  useEffect(() => {
    if (open) {
      setFiles({});
      setScreening(false);
    }
  }, [open]);

  function submit() {
    const documents: ApplicantDocument[] = slots
      .filter((s) => files[s.type])
      .map((s) => ({ type: s.type, name: s.label, fileName: files[s.type] }));
    if (documents.length === 0) return toast.error("Add at least one document.");

    setScreening(true);
    // Simulate AI screening latency, matching the upload flow.
    setTimeout(() => {
      actions.addDocuments(applicantId, documents);
      setScreening(false);
      onOpenChange(false);
      toast.success("Documents added — screening updated.");
    }, 1600);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !screening && onOpenChange(v)}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add documents</DialogTitle>
          <DialogDescription>
            Add supporting documents. Submitting re-runs AI screening against the role's criteria
            using all documents on file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {slots.map((s) => (
            <FileDropField
              key={s.type}
              label={s.label}
              optional
              fileName={files[s.type]}
              onPick={(n) => setFiles((prev) => ({ ...prev, [s.type]: n }))}
              onClear={() =>
                setFiles((prev) => {
                  const next = { ...prev };
                  delete next[s.type];
                  return next;
                })
              }
            />
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={screening}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={screening}>
            {screening ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Re-screening…
              </>
            ) : (
              "Add & re-screen"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
