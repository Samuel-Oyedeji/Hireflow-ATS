import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Mail,
  Settings,
  LogOut,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth";
import { useAppState } from "@/lib/store";
import markAsset from "@/assets/hireflow-mark.png";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/roles", label: "Roles", icon: Briefcase },
  { to: "/applicants", label: "Applicants", icon: Users },
  { to: "/templates", label: "Email templates", icon: Mail },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const navigate = useNavigate();
  const { currentUser, clinicName } = useAppState();

  const initials = currentUser
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-[image:var(--gradient-subtle)]">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[image:var(--gradient-brand-soft)] shadow-[var(--shadow-sm)] ring-1 ring-primary/10">
          <img src={markAsset} alt="HireFlow logo" className="h-7 w-7 object-contain" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-base font-semibold tracking-tight text-foreground">HireFlow</div>
          <div className="truncate text-xs text-muted-foreground">{clinicName}</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/dashboard" }}
            className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-secondary-foreground transition-all hover:bg-secondary data-[status=active]:bg-[image:var(--gradient-brand-soft)] data-[status=active]:text-sidebar-accent-foreground data-[status=active]:shadow-[var(--shadow-sm)] data-[status=active]:before:absolute data-[status=active]:before:left-0 data-[status=active]:before:top-1/2 data-[status=active]:before:h-5 data-[status=active]:before:w-1 data-[status=active]:before:-translate-y-1/2 data-[status=active]:before:rounded-full data-[status=active]:before:bg-primary"
          >
            <item.icon className="h-[18px] w-[18px] text-muted-foreground transition-colors group-data-[status=active]:text-primary" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg bg-card/70 px-2 py-2 ring-1 ring-border/60">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-xs font-semibold text-primary-foreground shadow-[var(--shadow-sm)]">
            {initials}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-foreground">{currentUser}</div>
            <div className="truncate text-xs text-muted-foreground">HR administrator</div>
          </div>
          <button
            aria-label="Sign out"
            onClick={() => {
              logout();
              navigate({ to: "/" });
            }}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            )}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}