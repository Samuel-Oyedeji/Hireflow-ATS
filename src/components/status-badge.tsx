import { cn } from "@/lib/utils";

export type Tone = "success" | "danger" | "warning" | "info" | "neutral";

const toneClasses: Record<Tone, string> = {
  success: "bg-success-muted text-success border-success/25",
  danger: "bg-danger-muted text-danger border-danger/25",
  warning: "bg-warning-muted text-warning border-warning/25",
  info: "bg-info-muted text-info border-info/25",
  neutral: "bg-secondary text-muted-foreground border-border",
};

const dotClasses: Record<Tone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

export function StatusBadge({
  tone,
  children,
  dot = false,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[tone])} />}
      {children}
    </span>
  );
}

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", dotClasses[tone], className)} />;
}

export function workingStatusTone(s: "advanced" | "rejected" | "pending"): Tone {
  return s === "advanced" ? "success" : s === "rejected" ? "danger" : "warning";
}

export function workingStatusLabel(s: "advanced" | "rejected" | "pending"): string {
  return s === "advanced" ? "Advanced" : s === "rejected" ? "Rejected" : "Pending review";
}

export function aiDecisionTone(d: "advanced" | "rejected"): Tone {
  return d === "advanced" ? "success" : "danger";
}