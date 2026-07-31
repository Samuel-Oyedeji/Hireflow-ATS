import { useEffect, useState } from "react";
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
import { prepareDocument } from "@/lib/uploads";
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
  const [files, setFiles] = useState<Record<string, File>>({});

  useEffect(() => {
    if (open) setFiles({});
  }, [open]);

  function submit() {
    const picked = slots.filter((s) => files[s.type]);
    if (picked.length === 0) return toast.error("Add at least one document.");

    // Capture the picked files, then close and run in the background so the user
    // isn't stuck on the dialog while screening runs. A toast reports progress.
    const chosen = picked.map((s) => ({
      file: files[s.type],
      name: s.label,
      type: s.type,
    }));
    onOpenChange(false);

    const run = (async () => {
      const documents = await Promise.all(
        chosen.map((c) =>
          prepareDocument(c.file, { name: c.name, type: c.type }, "resumes"),
        ),
      );
      await actions.addDocuments(applicantId, documents);
    })();

    toast.promise(run, {
      loading: "Re-screening with the new documents…",
      success: "Documents added — screening updated.",
      error: (err) =>
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong while re-screening. Please try again.",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              accept=".pdf,.doc,.docx,.txt"
              hint="PDF, DOCX, or TXT"
              fileName={files[s.type]?.name}
              onPick={() => {}}
              onPickFile={(f) => setFiles((prev) => ({ ...prev, [s.type]: f }))}
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Add &amp; re-screen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
