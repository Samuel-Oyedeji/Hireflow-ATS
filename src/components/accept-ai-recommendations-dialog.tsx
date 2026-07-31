import { Sparkles } from "lucide-react";
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
import { actions, useAppState } from "@/lib/store";
import type { Applicant, HumanDecision } from "@/lib/types";

/** The human decision that matches the AI's recommendation for an applicant. */
function suggestedDecision(a: Applicant): Exclude<HumanDecision, null> {
  return a.aiDecision === "advanced" ? "advance" : "reject";
}

/**
 * Bulk "accept AI recommendation" — for every pending applicant, save the human
 * decision that matches the AI's recommendation (advance/reject). Applied one at a
 * time behind a single toast; any applicant that fails is left pending, so a partial
 * failure never silently marks someone. Mirrors the BulkMarkInterviewedDialog flow.
 */
export function AcceptAiRecommendationsDialog({
  applicants,
  open,
  onOpenChange,
}: {
  applicants: Applicant[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { currentUser } = useAppState();

  const advanceCount = applicants.filter((a) => a.aiDecision === "advanced").length;
  const rejectCount = applicants.length - advanceCount;

  function submit() {
    if (applicants.length === 0) return;

    // Capture the pending applicants, close the dialog, and process in the background
    // behind a single toast so the user isn't stuck waiting on each save.
    const chosen = applicants.map((a) => ({
      id: a.id,
      name: a.name,
      decision: suggestedDecision(a),
    }));
    onOpenChange(false);

    const toastId = toast.loading(
      `Accepting AI recommendations for ${chosen.length} applicant${chosen.length === 1 ? "" : "s"}…`,
    );

    void (async () => {
      const failed: string[] = [];
      let succeeded = 0;
      for (const c of chosen) {
        try {
          // Not an override — we're accepting the AI's pick, so no reason note.
          await actions.saveDecision(c.id, c.decision, "", currentUser);
          succeeded += 1;
        } catch {
          failed.push(c.name);
        }
      }

      const done = `${succeeded} applicant${succeeded === 1 ? "" : "s"} decided`;
      const couldNot = `Couldn't save the decision for ${failed.join(", ")}.`;
      if (failed.length === 0) {
        toast.success(`${done}.`, { id: toastId });
      } else if (succeeded === 0) {
        toast.error(couldNot, { id: toastId });
      } else {
        toast.error(`${done}. ${couldNot}`, { id: toastId });
      }
    })();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Accept AI recommendations
          </DialogTitle>
          <DialogDescription>
            This applies the AI's recommendation to every applicant still awaiting review.
            You can still change any individual decision afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">Advance</span>
            <span className="font-semibold tabular-nums text-success">{advanceCount}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border py-1 pt-2">
            <span className="text-muted-foreground">Reject</span>
            <span className="font-semibold tabular-nums text-danger">{rejectCount}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={applicants.length === 0}>
            {`Accept ${applicants.length} recommendation${applicants.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
