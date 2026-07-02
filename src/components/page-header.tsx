import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  back,
  className,
  wide = false,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  back?: React.ReactNode;
  className?: string;
  /** Use a wider content max-width, e.g. for data-dense tables. Keep in sync with PageBody. */
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex flex-wrap items-center justify-between gap-3 px-8 py-4",
          wide ? "max-w-[96rem]" : "max-w-6xl",
        )}
      >
        <div className="min-w-0">
          {back}
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function PageBody({
  children,
  className,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Use a wider content max-width, e.g. for data-dense tables. Keep in sync with PageHeader. */
  wide?: boolean;
}) {
  return (
    <div className={cn("mx-auto px-8 py-8", wide ? "max-w-[96rem]" : "max-w-6xl", className)}>
      {children}
    </div>
  );
}