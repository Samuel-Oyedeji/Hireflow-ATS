import { cn } from "@/lib/utils";
import type { Tone } from "./status-badge";

const iconToneClasses: Record<Tone, string> = {
  success: "bg-success-muted text-success",
  danger: "bg-danger-muted text-danger",
  warning: "bg-warning-muted text-warning",
  info: "bg-info-muted text-info",
  neutral: "bg-secondary text-muted-foreground",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "info",
  hint,
  className,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
            iconToneClasses[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}