import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, Users, Clock, Send, Plus } from "lucide-react";

import { PageHeader, PageBody } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { RolesTable } from "@/components/roles-table";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { RoleFormDialog } from "@/components/role-form-dialog";
import { useAppState } from "@/lib/store";
import { invitedThisWeek, pendingReviewCount } from "@/lib/hireflow";

export const Route = createFileRoute("/_app/dashboard-old")({
  head: () => ({ meta: [{ title: "Dashboard — HireFlow" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { roles, applicants } = useAppState();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const openRoles = roles.filter((r) => r.status === "open");
  const topRoles = openRoles.slice(0, 5);

  return (
    <>
      <PageHeader
        title="Dashboard"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New role
          </Button>
        }
      />
      <PageBody className="space-y-6">
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

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Open roles</h2>
            {openRoles.length > 5 && (
              <Link to="/roles" className="text-sm text-primary hover:underline">
                View all roles
              </Link>
            )}
          </div>
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
            <RolesTable roles={topRoles} applicants={applicants} />
          )}
        </div>
      </PageBody>

      <RoleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(id) => navigate({ to: "/roles/$roleId", params: { roleId: id } })}
      />
    </>
  );
}