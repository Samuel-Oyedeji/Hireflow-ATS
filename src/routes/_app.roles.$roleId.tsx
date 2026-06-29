import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Pencil, Plus, Send, Users } from "lucide-react";

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
import { RoleFormDialog } from "@/components/role-form-dialog";
import { UploadApplicantDialog } from "@/components/upload-applicant-dialog";
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
  const [closeOpen, setCloseOpen] = useState(false);

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
              <Button variant="outline" onClick={() => setCloseOpen(true)}>
                Close role
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit role
            </Button>
          </>
        }
      />
      <PageBody className="space-y-6">
        {/* Criteria */}
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Screening criteria</h2>
          <div className="space-y-2.5">
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
          </div>
        </section>

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
              <Button onClick={() => setUploadOpen(true)}>
                <Plus className="h-4 w-4" /> Upload applicant
              </Button>
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
            <ApplicantsTable applicants={filtered} roles={roles} />
          )}
        </section>
      </PageBody>

      <RoleFormDialog open={editOpen} onOpenChange={setEditOpen} role={role} />
      <UploadApplicantDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultRoleId={role.id}
      />
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