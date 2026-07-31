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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actions, useAppState } from "@/lib/store";
import { renderTemplate } from "@/lib/hireflow";
import type { Applicant, Role } from "@/lib/types";

export function SendInvitesDialog({
  open,
  onOpenChange,
  role,
  recipients,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: Role;
  recipients: Applicant[];
}) {
  const { templates, clinicName, interviewLink } = useAppState();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open && templates[0]) setTemplateId(templates[0].id);
  }, [open, templates]);

  const template = templates.find((t) => t.id === templateId);
  const first = recipients[0];

  async function send() {
    setSending(true);
    try {
      await actions.sendInvites(recipients.map((r) => r.id));
      onOpenChange(false);
      toast.success(
        `Invites sent to ${recipients.length} applicant${recipients.length === 1 ? "" : "s"}.`,
      );
    } catch {
      toast.error("Couldn't send the invites. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send interview invites?</DialogTitle>
          <DialogDescription>
            These applicants will receive an interview invitation email for {role.title}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">
              Recipients ({recipients.length})
            </Label>
            <div className="max-h-40 overflow-y-auto rounded-md border border-border">
              {recipients.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-0"
                >
                  <span className="font-medium text-foreground">{r.name}</span>
                  <span className="text-muted-foreground">{r.email}</span>
                </div>
              ))}
            </div>
          </div>

          {template && first && (
            <div>
              <Label className="mb-1.5 block">Preview · {first.name}</Label>
              <div className="rounded-md border border-border bg-secondary/30 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Subject</div>
                <div className="mb-3 text-sm font-medium text-foreground">
                  {renderTemplate(template.subject, {
                    applicant_name: first.name,
                    role_title: role.title,
                    clinic_name: clinicName,
                    interview_scheduling_link: interviewLink,
                  })}
                </div>
                <div className="whitespace-pre-wrap text-sm text-foreground">
                  {renderTemplate(template.body, {
                    applicant_name: first.name,
                    role_title: role.title,
                    clinic_name: clinicName,
                    interview_scheduling_link: interviewLink,
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending || !template || recipients.length === 0}>
            {sending ? "Sending…" : "Send invites"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}