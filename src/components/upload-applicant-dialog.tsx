import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileText, Loader2, Upload, X } from "lucide-react";
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
import { actions, useAppState } from "@/lib/store";
import type { ApplicantDocument } from "@/lib/types";

type Slot = { type: ApplicantDocument["type"]; label: string; optional?: boolean };
const slots: Slot[] = [
  { type: "resume", label: "Resume / CV" },
  { type: "cover-letter", label: "Cover letter", optional: true },
  { type: "other", label: "Other supporting document", optional: true },
];

function FileSlot({
  slot,
  fileName,
  onPick,
  onClear,
}: {
  slot: Slot;
  fileName?: string;
  onPick: (name: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-2">
        {slot.label}
        {slot.optional && <span className="text-xs font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {fileName ? (
        <div className="flex items-center gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2.5">
          <FileText className="h-4 w-4 text-primary" />
          <span className="flex-1 truncate text-sm text-foreground">{fileName}</span>
          <button
            type="button"
            aria-label="Remove file"
            onClick={onClear}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onPick(f.name);
          }}
          className={`flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm transition-colors ${
            drag ? "border-primary bg-accent" : "border-border bg-card hover:bg-secondary/50"
          }`}
        >
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            Drag & drop or <span className="text-primary">browse</span> · PDF, DOCX
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f.name);
            }}
          />
        </button>
      )}
    </div>
  );
}

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
  const [files, setFiles] = useState<Record<string, string>>({});
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

  function submit() {
    if (!name.trim()) return toast.error("Add the applicant's name.");
    if (!email.trim()) return toast.error("Add the applicant's email.");
    if (!roleId) return toast.error("Select the role being applied for.");
    if (!files.resume) return toast.error("A resume / CV is required.");

    setScreening(true);
    const documents: ApplicantDocument[] = slots
      .filter((s) => files[s.type])
      .map((s) => ({ type: s.type, name: s.label, fileName: files[s.type] }));

    // Simulate AI screening latency.
    setTimeout(() => {
      const id = actions.addApplicant({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        roleId,
        documents,
      });
      setScreening(false);
      onOpenChange(false);
      toast.success("Screening complete.");
      navigate({ to: "/applicants/$applicantId", params: { applicantId: id } });
    }, 1600);
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
              <FileSlot
                key={s.type}
                slot={s}
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