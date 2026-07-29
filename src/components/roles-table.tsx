import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { Applicant, Role } from "@/lib/types";
import { formatDate, roleCounts } from "@/lib/hireflow";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

function CountCell({ value, tone }: { value: number; tone: "success" | "danger" | "warning" }) {
  if (value === 0) return <span className="text-sm text-muted-foreground">0</span>;
  return (
    <StatusBadge tone={tone} className="tabular-nums">
      {value}
    </StatusBadge>
  );
}

export function RolesTable({
  roles,
  applicants,
}: {
  roles: Role[];
  applicants: Applicant[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b border-border bg-[var(--surface-muted)]">
            <tr className="text-left">
              <Th>Role title</Th>
              <Th>Department</Th>
              <Th className="text-center">Applicants</Th>
              <Th className="text-center">Advanced</Th>
              <Th className="text-center">Rejected</Th>
              <Th className="text-center">Pending</Th>
              <Th>Created</Th>
              <Th className="text-right">{""}</Th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => {
              const c = roleCounts(applicants, role.id);
              return (
                <tr
                  key={role.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-accent/50"
                >
                  <Td>
                    <Link
                      to="/roles/$roleId"
                      params={{ roleId: role.id }}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {role.title}
                    </Link>
                    {role.status === "closed" && (
                      <span className="ml-2 align-middle text-xs text-muted-foreground">Closed</span>
                    )}
                  </Td>
                  <Td className="text-muted-foreground">{role.department}</Td>
                  <Td className="text-center font-medium tabular-nums">{c.total}</Td>
                  <Td className="text-center">
                    <CountCell value={c.advanced} tone="success" />
                  </Td>
                  <Td className="text-center">
                    <CountCell value={c.rejected} tone="danger" />
                  </Td>
                  <Td className="text-center">
                    <CountCell value={c.pending} tone="warning" />
                  </Td>
                  <Td className="text-muted-foreground whitespace-nowrap">
                    {formatDate(role.createdDate)}
                  </Td>
                  <Td className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/roles/$roleId" params={{ roleId: role.id }}>
                        View
                      </Link>
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("h-14 px-5 align-middle", className)}>{children}</td>;
}