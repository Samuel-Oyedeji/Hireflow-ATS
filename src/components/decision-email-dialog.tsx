import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/lib/store";
import { renderTemplate } from "@/lib/hireflow";
import type { Applicant, Role } from "@/lib/types";

// Which template's `used_for` tag backs each outcome. Seeded in
// supabase/migrations/0004_decision_templates.sql.
const usedForByDecision: Record<"hire" | "reject", string> = {
  hire: "Hire offer",
  reject: "Rejection",
};

export function DecisionEmailDialog({
  open,
  onOpenChange,
  applicant,
  role,
  decision,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  applicant: Applicant;
  role?: Role;
  decision: "hire" | "reject";
}) {
  const { templates, clinicName, interviewLink } = useAppState();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Prefer the exact tag; fall back to any template whose tag mentions the
  // outcome, so a renamed template still resolves.
  const wanted = usedForByDecision[decision].toLowerCase();
  const template =
    templates.find((t) => t.usedFor.toLowerCase() === wanted) ??
    templates.find((t) => t.usedFor.toLowerCase().includes(decision));

  useEffect(() => {
    if (!open) return;
    const vars = {
      applicant_name: applicant.name,
      role_title: role?.title ?? "the role",
      clinic_name: clinicName,
      interview_scheduling_link: interviewLink,
    };
    setTo(applicant.email);
    setSubject(template ? renderTemplate(template.subject, vars) : "");
    setBody(template ? renderTemplate(template.body, vars) : "");
  }, [open, template, applicant, role, clinicName, interviewLink]);

  function send() {
    if (!to.trim()) return toast.error("Add a recipient email.");
    // Simulated send — no email backend is wired up yet.
    toast.success(`Email sent to ${to.trim()}.`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Email {applicant.name} — {decision === "hire" ? "offer" : "rejection"}
          </DialogTitle>
          <DialogDescription>
            {template
              ? "Loaded from your template. Edit anything below, then open your email client to send."
              : `No "${usedForByDecision[decision]}" template found — write the email below or create one under Email templates.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-to">To</Label>
            <Input
              id="email-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-body">Body</Label>
            <Textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              className="text-sm leading-relaxed"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={send}>
            <Mail className="h-4 w-4" /> Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
