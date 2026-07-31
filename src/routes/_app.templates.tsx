import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Mail, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageBody } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { actions, useAppState } from "@/lib/store";
import { formatDate } from "@/lib/hireflow";
import type { EmailTemplate } from "@/lib/types";

export const Route = createFileRoute("/_app/templates")({
  head: () => ({ meta: [{ title: "Email templates — HireFlow" }] }),
  component: TemplatesPage,
});

const placeholders = [
  { token: "{{applicant_name}}", desc: "The applicant's full name" },
  { token: "{{role_title}}", desc: "The role they applied for" },
  { token: "{{clinic_name}}", desc: "Your clinic name" },
  { token: "{{interview_scheduling_link}}", desc: "Interview booking link (set in Settings)" },
];

function TemplatesPage() {
  const { templates } = useAppState();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Email templates"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        }
      />
      <PageBody>
        {templates.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No templates yet"
            description="Create an email template to send interview invites."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> New template
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Template name
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Used for
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Last edited
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setEditing(t)}
                    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-secondary/50"
                  >
                    <td className="h-[52px] px-4 align-middle font-medium text-foreground">{t.name}</td>
                    <td className="h-[52px] px-4 align-middle text-muted-foreground">{t.usedFor}</td>
                    <td className="h-[52px] px-4 align-middle text-muted-foreground">
                      {formatDate(t.lastEdited)}
                    </td>
                    <td className="h-[52px] px-4 text-right align-middle">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(t);
                        }}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>

      <TemplateDialog
        open={creating || editing !== null}
        template={editing}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
    </>
  );
}

function TemplateDialog({
  open,
  template,
  onOpenChange,
}: {
  open: boolean;
  template: EmailTemplate | null;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [usedFor, setUsedFor] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [activeField, setActiveField] = useState<"subject" | "body">("body");
  const [saving, setSaving] = useState(false);

  function insertPlaceholder(token: string) {
    if (activeField === "subject") {
      setSubject((s) => `${s}${token}`);
    } else {
      setBody((b) => `${b}${token}`);
    }
  }

  useEffect(() => {
    if (open) {
      setName(template?.name ?? "");
      setUsedFor(template?.usedFor ?? "Interview invite");
      setSubject(template?.subject ?? "");
      setBody(template?.body ?? "");
    }
  }, [open, template]);

  async function save() {
    if (!name.trim()) return toast.error("Add a template name.");
    if (!subject.trim()) return toast.error("Add a subject line.");
    setSaving(true);
    try {
      await actions.upsertTemplate({
        id: template?.id,
        name: name.trim(),
        usedFor: usedFor.trim() || "Interview invite",
        subject: subject.trim(),
        body,
      });
      onOpenChange(false);
      toast.success("Template saved.");
    } catch {
      toast.error("Couldn't save the template. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>
            Use placeholders to personalize each email. They're filled in automatically when sending.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_220px]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="t-name">Template name</Label>
                <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-used">Used for</Label>
                <Input id="t-used" value={usedFor} onChange={(e) => setUsedFor(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-subject">Subject line</Label>
              <Input
                id="t-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onFocus={() => setActiveField("subject")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-body">Body</Label>
              <Textarea
                id="t-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onFocus={() => setActiveField("body")}
                rows={12}
                className="font-mono text-xs leading-relaxed"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="block">Available placeholders</Label>
            <div className="space-y-1.5 rounded-md border border-border bg-secondary/30 p-3">
              {placeholders.map((p) => (
                <button
                  key={p.token}
                  type="button"
                  onClick={() => insertPlaceholder(p.token)}
                  className="block w-full rounded px-2 py-1 text-left hover:bg-secondary"
                  title="Click to insert into the focused field"
                >
                  <code className="block break-all text-xs font-medium text-primary">{p.token}</code>
                  <span className="block text-xs text-muted-foreground">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => toast.success("Test email sent.")}>
            Send test email
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save template"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}