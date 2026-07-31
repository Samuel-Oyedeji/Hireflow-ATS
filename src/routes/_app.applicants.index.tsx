import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Sparkles, Users } from "lucide-react";

import { PageHeader, PageBody } from "@/components/page-header";
import { ApplicantsTable } from "@/components/applicants-table";
import { AcceptAiRecommendationsDialog } from "@/components/accept-ai-recommendations-dialog";
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
import { useAppState } from "@/lib/store";
import { workingStatus } from "@/lib/hireflow";

export const Route = createFileRoute("/_app/applicants/")({
  head: () => ({ meta: [{ title: "Applicants — HireFlow" }] }),
  component: ApplicantsPage,
});

function ApplicantsPage() {
  const { applicants, roles } = useAppState();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [acceptAllOpen, setAcceptAllOpen] = useState(false);

  const pending = useMemo(
    () => applicants.filter((a) => a.humanDecision === null),
    [applicants],
  );

  const sorted = useMemo(
    () => [...applicants].sort((a, b) => b.submittedDate.localeCompare(a.submittedDate)),
    [applicants],
  );

  const filtered = sorted.filter((a) => {
    if (query && !a.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (roleFilter !== "all" && a.roleId !== roleFilter) return false;
    if (statusFilter !== "all" && workingStatus(a) !== statusFilter) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title="Applicants"
        description="Every applicant across all roles."
        wide
        action={
          pending.length > 0 ? (
            <Button onClick={() => setAcceptAllOpen(true)}>
              <Sparkles className="h-4 w-4" />
              Accept AI for {pending.length} pending
            </Button>
          ) : undefined
        }
      />
      <PageBody className="space-y-4" wide>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name"
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="pending">Pending review</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {applicants.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No applicants yet"
            description="Open a role and upload an applicant to run AI screening."
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Search} title="No applicants match your filters" />
        ) : (
          <ApplicantsTable applicants={filtered} roles={roles} showRole selectable />
        )}
      </PageBody>

      <AcceptAiRecommendationsDialog
        applicants={pending}
        open={acceptAllOpen}
        onOpenChange={setAcceptAllOpen}
      />
    </>
  );
}