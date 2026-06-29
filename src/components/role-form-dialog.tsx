import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actions } from "@/lib/store";
import type { Criterion, CriterionWeight, Role } from "@/lib/types";

type DraftCriterion = { id: string; label: string; detail: string; weight: CriterionWeight };

function emptyCriterion(): DraftCriterion {
  return { id: `nc-${Math.random().toString(36).slice(2, 8)}`, label: "", detail: "", weight: "required" };
}

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role?: Role;
  onSaved?: (id: string) => void;
}) {
  const isEdit = !!role;
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [statusOpen, setStatusOpen] = useState(true);
  const [criteria, setCriteria] = useState<DraftCriterion[]>([emptyCriterion()]);

  useEffect(() => {
    if (!open) return;
    if (role) {
      setTitle(role.title);
      setDepartment(role.department);
      setStatusOpen(role.status === "open");
      setCriteria(role.criteria.map((c) => ({ ...c })));
    } else {
      setTitle("");
      setDepartment("");
      setStatusOpen(true);
      setCriteria([emptyCriterion()]);
    }
  }, [open, role]);

  function updateCriterion(id: string, patch: Partial<DraftCriterion>) {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function save() {
    if (!title.trim()) {
      toast.error("Add a role title.");
      return;
    }
    if (!department.trim()) {
      toast.error("Add a department.");
      return;
    }
    const cleaned = criteria
      .filter((c) => c.label.trim())
      .map<Criterion>((c) => ({
        id: c.id.startsWith("nc-") ? `${Math.random().toString(36).slice(2, 9)}` : c.id,
        label: c.label.trim(),
        detail: c.detail.trim(),
        weight: c.weight,
      }));
    if (cleaned.length === 0) {
      toast.error("Add at least one screening criterion.");
      return;
    }
    const id = actions.upsertRole({
      id: role?.id,
      title: title.trim(),
      department: department.trim(),
      status: statusOpen ? "open" : "closed",
      criteria: cleaned,
    });
    toast.success(isEdit ? "Role updated." : "Role created.");
    onOpenChange(false);
    onSaved?.(id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit role" : "New role"}</DialogTitle>
          <DialogDescription>
            Define the role and the screening criteria the AI uses to assess applicants.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="role-title">Role title</Label>
              <Input
                id="role-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Registered physiotherapist"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-dept">Department</Label>
              <Input
                id="role-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Physiotherapy"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-foreground">Status</div>
              <div className="text-xs text-muted-foreground">
                {statusOpen ? "Open — accepting applicants" : "Closed — not accepting applicants"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{statusOpen ? "Open" : "Closed"}</span>
              <Switch checked={statusOpen} onCheckedChange={setStatusOpen} />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>Screening criteria</Label>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              These criteria are what the AI screens each applicant against.
            </p>

            <div className="space-y-3">
              {criteria.map((c, idx) => (
                <div key={c.id} className="rounded-md border border-border bg-card p-3">
                  <div className="mb-2 flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={c.label}
                        onChange={(e) => updateCriterion(c.id, { label: e.target.value })}
                        placeholder="Criterion label (e.g. Minimum years of experience)"
                      />
                      <Textarea
                        value={c.detail}
                        onChange={(e) => updateCriterion(c.id, { detail: e.target.value })}
                        placeholder="Detail (e.g. Must hold a valid RPT license in Ontario)"
                        rows={2}
                      />
                    </div>
                    <button
                      type="button"
                      aria-label="Remove criterion"
                      onClick={() =>
                        setCriteria((prev) =>
                          prev.length > 1 ? prev.filter((x) => x.id !== c.id) : prev,
                        )
                      }
                      className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
                      disabled={criteria.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Importance</span>
                    <Select
                      value={c.weight}
                      onValueChange={(v) => updateCriterion(c.id, { weight: v as CriterionWeight })}
                    >
                      <SelectTrigger className="h-8 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="preferred">Preferred</SelectItem>
                        <SelectItem value="nice-to-have">Nice-to-have</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="ml-auto text-xs text-muted-foreground">#{idx + 1}</span>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setCriteria((prev) => [...prev, emptyCriterion()])}
            >
              <Plus className="h-4 w-4" /> Add criterion
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save role</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}