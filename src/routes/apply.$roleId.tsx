import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropField } from "@/components/file-drop-field";
import { getPublicRoleFn, submitPublicApplicationFn } from "@/lib/data";
import { prepareDocument } from "@/lib/uploads";
import type { ApplicantDocument } from "@/lib/types";

export const Route = createFileRoute("/apply/$roleId")({
  head: () => ({ meta: [{ title: "Apply — HireFlow" }] }),
  // Scoped fetch: returns only the role's public fields + clinic name, never applicant data.
  loader: ({ params }) => getPublicRoleFn({ data: params.roleId }),
  component: PublicApplyPage,
});

type Slot = { type: ApplicantDocument["type"]; label: string; optional?: boolean };
const slots: Slot[] = [
  { type: "resume", label: "Resume / CV" },
  { type: "cover-letter", label: "Cover letter", optional: true },
  { type: "other", label: "Supporting document", optional: true },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[image:var(--gradient-brand-soft)] px-4 py-10">
      <div className="mx-auto w-full max-w-lg">{children}</div>
    </div>
  );
}

function PublicApplyPage() {
  const { roleId } = Route.useParams();
  const { clinicName, role } = Route.useLoaderData();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [files, setFiles] = useState<Record<string, File>>({});
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Role missing or closed — show a calm message, never a 404 (applicants shouldn't
  // land on a broken page).
  if (!role || role.status !== "open") {
    return (
      <Shell>
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-sm font-medium text-muted-foreground">{clinicName}</p>
          <h1 className="mt-3 text-lg font-semibold text-foreground">
            This position is no longer accepting applications.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Thanks for your interest — please check back for future openings.
          </p>
        </div>
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell>
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            Your application has been submitted.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We'll be in touch if you're shortlisted. Thank you for applying to {clinicName}.
          </p>
        </div>
      </Shell>
    );
  }

  async function submit() {
    if (!name.trim()) return toast.error("Please enter your full name.");
    if (!email.trim()) return toast.error("Please enter your email address.");
    if (!files.resume) return toast.error("A resume / CV is required.");

    // Honeypot: bots fill hidden fields. Silently accept without creating a record.
    if (honeypot.trim()) {
      setSubmitted(true);
      return;
    }

    setSubmitting(true);
    try {
      const documents = await Promise.all(
        slots
          .filter((s) => files[s.type])
          .map((s) => prepareDocument(files[s.type], { name: s.label, type: s.type }, "public")),
      );
      await submitPublicApplicationFn({
        data: {
          roleId,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          documents,
        },
      });
      setSubmitted(true);
    } catch {
      toast.error("Something went wrong submitting your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell>
      <div className="mb-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">{clinicName}</p>
        <h1 className="mt-1 text-xl font-semibold text-foreground">
          Applying for: {role.title} — {role.department}
        </h1>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ap-name">Full name</Label>
            <Input
              id="ap-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-email">Email address</Label>
            <Input
              id="ap-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-phone">
              Phone number <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="ap-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(000) 000-0000"
              disabled={submitting}
            />
          </div>

          <div className="space-y-3 pt-1">
            {slots.map((s) => (
              <FileDropField
                key={s.type}
                label={s.label}
                optional={s.optional}
                hint="PDF or DOCX · max 10MB"
                fileName={files[s.type]?.name}
                onPick={() => {}}
                onPickFile={(f) => setFiles((prev) => ({ ...prev, [s.type]: f }))}
                onClear={() =>
                  setFiles((prev) => {
                    const next = { ...prev };
                    delete next[s.type];
                    return next;
                  })
                }
              />
            ))}
          </div>

          {/* Honeypot — hidden from humans, catches basic spam bots. */}
          <div aria-hidden className="hidden">
            <label>
              Company
              <input
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </label>
          </div>

          <Button className="w-full" onClick={submit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
              </>
            ) : (
              "Submit application"
            )}
          </Button>
        </div>
      </div>
    </Shell>
  );
}
