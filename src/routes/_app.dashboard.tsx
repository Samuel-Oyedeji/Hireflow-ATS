import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, Users, Clock, Send, Plus, ChevronDown } from "lucide-react";

import { PageHeader, PageBody } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { RolesTable } from "@/components/roles-table";
import { ApplicantsTable } from "@/components/applicants-table";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleFormDialog } from "@/components/role-form-dialog";
import { UploadApplicantDialog } from "@/components/upload-applicant-dialog";
import { BulkImportDialog } from "@/components/bulk-import-dialog";
import { useAppState } from "@/lib/store";
import { invitedThisWeek, lifecycleStage, pendingReviewCount } from "@/lib/hireflow";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — HireFlow" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { roles, applicants } = useAppState();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");

  const openRoles = roles.filter((r) => r.status === "open");
  const topRoles = openRoles.slice(0, 5);

  const invited = applicants.filter((a) => a.invited);
  const invitedRoles = roles.filter((r) => invited.some((a) => a.roleId === r.id));
  const invitedFiltered = invited.filter(
    (a) =>
      (roleFilter === "all" || a.roleId === roleFilter) &&
      (stageFilter === "all" || lifecycleStage(a) === stageFilter),
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        wide
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                disabled={openRoles.length === 0}
                title={openRoles.length === 0 ? "Create an open role first" : undefined}
              >
                <Plus className="h-4 w-4" /> Upload applicant
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setUploadOpen(true)}>
                Add single applicant
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setBulkOpen(true)}>Bulk import</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <PageBody className="space-y-6" wide>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Open roles" value={openRoles.length} icon={Briefcase} tone="info" />
          <StatCard label="Total applicants" value={applicants.length} icon={Users} tone="info" />
          <StatCard
            label="Pending review"
            value={pendingReviewCount(applicants)}
            icon={Clock}
            tone="warning"
            hint="Awaiting human confirmation"
          />
          <StatCard
            label="Invites sent this week"
            value={invitedThisWeek(applicants)}
            icon={Send}
            tone="success"
          />
        </div>

        <Tabs defaultValue="roles">
          <TabsList>
            <TabsTrigger value="roles">Open roles ({openRoles.length})</TabsTrigger>
            <TabsTrigger value="invited">Invited applicants ({invited.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="mt-4">
            {roles.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No open roles yet"
                description="Create your first role to start screening applicants."
                action={
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" /> Create your first role
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {openRoles.length > 5 && (
                  <div className="flex justify-end">
                    <Link to="/roles" className="text-sm text-primary hover:underline">
                      View all roles
                    </Link>
                  </div>
                )}
                <RolesTable roles={topRoles} applicants={applicants} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="invited" className="mt-4 space-y-4">
            {invited.length === 0 ? (
              <EmptyState
                icon={Send}
                title="No invited applicants yet"
                description="Applicants you advance and invite to interview will show up here."
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="All roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      {invitedRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All stages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All stages</SelectItem>
                      <SelectItem value="invited">Invited</SelectItem>
                      <SelectItem value="interviewed">Interviewed</SelectItem>
                      <SelectItem value="decided">Decided</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {invitedFiltered.length === 0 ? (
                  <EmptyState icon={Send} title="No applicants match these filters" />
                ) : (
                  <ApplicantsTable applicants={invitedFiltered} roles={roles} showRole selectable />
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </PageBody>

      <RoleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(id) => navigate({ to: "/roles/$roleId", params: { roleId: id } })}
      />
      <UploadApplicantDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <BulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} />
    </>
  );
}
