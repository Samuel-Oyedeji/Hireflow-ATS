import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, Copy, Pencil, Plus, Send, Users } from "lucide-react";

import { PageHeader, PageBody } from "@/components/page-header";
import { ApplicantsTable } from "@/components/applicants-table";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RoleFormDialog } from "@/components/role-form-dialog";
import { UploadApplicantDialog } from "@/components/upload-applicant-dialog";
import { BulkImportDialog } from "@/components/bulk-import-dialog";
import { SendInvitesDialog } from "@/components/send-invites-dialog";
import { actions, useAppState } from "@/lib/store";
import {
  applicantsForRole,
  inviteEligible,
  roleCounts,
  weightLabel,
  workingStatus,
} from "@/lib/hireflow";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/roles/$roleId")({
  head: () => ({ meta: [{ title: "Role — HireFlow" }] }),
  component: RoleDetailPage,
});

const weightTone = { required: "info", preferred: "neutral", "nice-to-have": "neutral" } as const;

function RoleDetailPage() {
  const { roleId } = Route.useParams();
  const { roles, applicants } = useAppState();
  const role = roles.find((r) => r.id === roleId);

  const [tab, setTab] = useState("all");
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [invitesOpen, setInvitesOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [origin, setOrigin] = useState("");

  // Public apply URL is client-only; resolve the origin after mount.
  useEffect(() => setOrigin(window.location.origin), []);

  if (!role) {
    return (
      <>
        <PageHeader title="Role not found" />
        <PageBody>
          <EmptyState
            icon={Users}
            title="This role doesn't exist"
            description="It may have been removed."
            action={
              <Button asChild variant="outline">
                <Link to="/roles">Back to roles</Link>
              </Button>
            }
          />
        </PageBody>
      </>
    );
  }

  const roleApplicants = applicantsForRole(applicants, role.id);
  const counts = roleCounts(applicants, role.id);
  const eligible = inviteEligible(applicants, role.id);
  const applyUrl = `${origin}/apply/${role.id}`;

  function copyApplyLink() {
    navigator.clipboard
      .writeText(applyUrl)
      .then(() => toast.success("Link copied"))
      .catch(() => toast.error("Couldn't copy the link."));
  }

  const filtered = roleApplicants.filter((a) => {
    if (tab === "all") return true;
    return workingStatus(a) === tab;
  });

  return (
    <>
      <PageHeader
        title={role.title}
        back={
          <Link
            to="/roles"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Roles
          </Link>
        }
        description={
          <span className="flex items-center gap-2">
            {role.department}
            <span className="text-border">·</span>
            <StatusBadge tone={role.status === "open" ? "info" : "neutral"}>
              {role.status === "open" ? "Open" : "Closed"}
            </StatusBadge>
          </span>
        }
        action={
          <>
            {role.status === "open" && (
              <Button variant="outline" onClick={copyApplyLink}>
                <Copy className="h-4 w-4" /> Copy application link
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit role
            </Button>
            {role.status === "open" && (
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setCloseOpen(true)}
              >
                Close role
              </Button>
            )}
          </>
        }
      />
      <PageBody className="space-y-6">
        {/* Criteria */}
        <Collapsible className="rounded-lg border border-border bg-card shadow-sm">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-5 text-left [&[data-state=open]>svg]:rotate-180">
            <h2 className="text-sm font-semibold text-foreground">Screening criteria</h2>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2.5 px-5 pb-5">
            {role.criteria.map((c) => (
              <div key={c.id} className="flex flex-wrap items-start gap-2">
                <StatusBadge tone={weightTone[c.weight]}>{weightLabel[c.weight]}</StatusBadge>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground">{c.label}</span>
                  {c.detail && (
                    <span className="text-sm text-muted-foreground"> — {c.detail}</span>
                  )}
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* Applicants */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Applicants</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setInvitesOpen(true)}
                disabled={eligible.length === 0}
                title={
                  eligible.length === 0
                    ? "Confirm at least one applicant as advanced to send invites"
                    : undefined
                }
              >
                <Send className="h-4 w-4" /> Finalize & send invites
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4" /> Upload applicant
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setUploadOpen(true)}>
                    Add single applicant
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setBulkOpen(true)}>
                    Bulk import
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All applicants ({counts.total})</TabsTrigger>
              <TabsTrigger value="advanced">Advanced ({counts.advanced})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
              <TabsTrigger value="pending">Pending review ({counts.pending})</TabsTrigger>
            </TabsList>
          </Tabs>

          {roleApplicants.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No applicants yet"
              description="Upload an applicant to run AI screening against this role's criteria."
              action={
                <Button onClick={() => setUploadOpen(true)}>
                  <Plus className="h-4 w-4" /> Upload applicant
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} title="No applicants in this view" />
          ) : (
            <ApplicantsTable applicants={filtered} roles={roles} selectable />
          )}
        </section>
      </PageBody>

      <RoleFormDialog open={editOpen} onOpenChange={setEditOpen} role={role} />
      <UploadApplicantDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultRoleId={role.id}
      />
      <BulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} roleId={role.id} />
      <SendInvitesDialog
        open={invitesOpen}
        onOpenChange={setInvitesOpen}
        role={role}
        recipients={eligible}
      />

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this role?</AlertDialogTitle>
            <AlertDialogDescription>
              {role.title} will stop accepting new applicants. You can reopen it later by editing the
              role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                actions.setRoleStatus(role.id, "closed");
                toast.success("Role closed.");
              }}
            >
              Close role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}