import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Briefcase, Plus, Search } from "lucide-react";

import { PageHeader, PageBody } from "@/components/page-header";
import { RolesTable } from "@/components/roles-table";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleFormDialog } from "@/components/role-form-dialog";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/_app/roles/")({
  head: () => ({ meta: [{ title: "Roles — HireFlow" }] }),
  component: RolesPage,
});

function RolesPage() {
  const { roles, applicants } = useAppState();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");

  const departments = useMemo(
    () => Array.from(new Set(roles.map((r) => r.department))).sort(),
    [roles],
  );

  const filtered = roles.filter((r) => {
    if (query && !r.title.toLowerCase().includes(query.toLowerCase())) return false;
    if (dept !== "all" && r.department !== dept) return false;
    if (status !== "all" && r.status !== status) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title="Roles"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New role
          </Button>
        }
      />
      <PageBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title"
              className="pl-9"
            />
          </div>
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {roles.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No roles yet"
            description="Create your first role to start screening applicants."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Create your first role
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No roles match your filters"
            description="Try adjusting your search or clearing the filters."
          />
        ) : (
          <RolesTable roles={filtered} applicants={applicants} />
        )}
      </PageBody>

      <RoleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(id) => navigate({ to: "/roles/$roleId", params: { roleId: id } })}
      />
    </>
  );
}