import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { isAuthed } from "@/lib/auth";
import { hydrate, useHydrated } from "@/lib/store";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    if (!isAuthed()) {
      navigate({ to: "/", replace: true });
      return;
    }
    setReady(true);
    // Load all data from Supabase once, client-side.
    hydrate().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [navigate]);

  if (!ready) return null;

  if (error) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Couldn't load your data</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
        </div>
        <Button
          onClick={() => {
            setError(null);
            hydrate().catch((e) => setError(e instanceof Error ? e.message : String(e)));
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="h-screen flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
