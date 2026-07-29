import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageBody } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions, useAppState } from "@/lib/store";
import { logout } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — HireFlow" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { clinicName, currentUser } = useAppState();
  const navigate = useNavigate();
  const [name, setName] = useState(clinicName);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <PageHeader title="Settings" />
      <PageBody className="max-w-2xl space-y-6">
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Clinic</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This name appears in interview invite emails as {"{{clinic_name}}"}.
          </p>
          <div className="mt-4 max-w-md space-y-1.5">
            <Label htmlFor="clinic">Clinic name</Label>
            <Input id="clinic" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="mt-4">
            <Button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await actions.setClinicName(name.trim() || clinicName);
                  toast.success("Settings saved.");
                } catch {
                  toast.error("Couldn't save settings. Please try again.");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Account</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Signed in as</dt>
              <dd className="font-medium text-foreground">{currentUser}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                logout();
                navigate({ to: "/" });
              }}
            >
              Sign out
            </Button>
          </div>
        </section>
      </PageBody>
    </>
  );
}