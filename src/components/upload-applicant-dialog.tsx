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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDropField } from "@/components/file-drop-field";
import { actions, useAppState } from "@/lib/store";
import { prepareDocument } from "@/lib/uploads";
import type { ApplicantDocument } from "@/lib/types";

type Slot = { type: ApplicantDocument["type"]; label: string; optional?: boolean };
const slots: Slot[] = [
  { type: "resume", label: "Resume / CV" },
  { type: "cover-letter", label: "Cover letter", optional: true },
  { type: "other", label: "Other supporting document", optional: true },
];

export function UploadApplicantDialog({
  open,
  onOpenChange,
  defaultRoleId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultRoleId?: string;
}) {
  const navigate = useNavigate();
  const { roles } = useAppState();
  const openRoles = roles.filter((r) => r.status === "open");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState(defaultRoleId ?? "");
  const [files, setFiles] = useState<Record<string, File>>({});
  const [screening, setScreening] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setPhone("");
      setRoleId(defaultRoleId ?? "");
      setFiles({});
      setScreening(false);
    }
  }, [open, defaultRoleId]);

  async function submit() {
    if (!name.trim()) return toast.error("Add the applicant's name.");
    if (!email.trim()) return toast.error("Add the applicant's email.");
    if (!roleId) return toast.error("Select the role being applied for.");
    if (!files.resume) return toast.error("A resume / CV is required.");

    setScreening(true);
    try {
      // Upload each file to storage and extract its text, then run real AI screening.
      const documents = await Promise.all(
        slots
          .filter((s) => files[s.type])
          .map((s) => prepareDocument(files[s.type], { name: s.label, type: s.type }, "resumes")),
      );
      const id = await actions.addApplicant({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        roleId,
        documents,
        source: "manual_upload",
      });
      onOpenChange(false);
      toast.success("Screening complete.");
      navigate({ to: "/applicants/$applicantId", params: { applicantId: id } });
    } catch {
      toast.error("Something went wrong while screening. Please try again.");
    } finally {
      setScreening(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !screening && onOpenChange(v)}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload applicant</DialogTitle>
          <DialogDescription>
            Add applicant details and documents. Submitting runs AI screening against the role's criteria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ap-name">Applicant name</Label>
              <Input id="ap-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-email">Email</Label>
              <Input id="ap-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-phone">
                Phone <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="ap-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(000) 000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Role applied for</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {openRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {slots.map((s) => (
              <FileDropField
                key={s.type}
                label={s.label}
                optional={s.optional}
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={screening}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={screening}>
            {screening ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Screening applicant…
              </>
            ) : (
              "Submit for screening"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}