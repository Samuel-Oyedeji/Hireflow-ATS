import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDropField } from "@/components/file-drop-field";
import { cn } from "@/lib/utils";
import { actions, useAppState } from "@/lib/store";
import type { ApplicantDocument } from "@/lib/types";

type NewApplicant = {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  documents: ApplicantDocument[];
};

/**
 * A prepared, not-yet-committed import. `toCreate` are the applicant records that
 * will be created (imported + needs-attention); `skippedFiles` are never created.
 */
type ImportPlan = {
  fileName: string;
  toCreate: NewApplicant[];
  imported: { name: string; email: string }[];
  needsAttention: string[]; // file names we couldn't extract contact info from
  skippedFiles: string[]; // unsupported files / invalid rows — not imported
};

type CsvPreviewRow = {
  name: string;
  email: string;
  phone?: string;
  resume: string;
  valid: boolean;
};
type Phase = "idle" | "processing" | "done";

/* -------------------- Mode A: ZIP (simulated extraction) -------------------- */
// No client-side unzip library is bundled, so extraction is simulated in the same
// spirit as the app's mock AI screening. See plan Decision #2.
const FIRST = [
  "Olivia",
  "Liam",
  "Emma",
  "Noah",
  "Ava",
  "Ethan",
  "Sophia",
  "Mason",
  "Isabella",
  "Lucas",
  "Mia",
  "Amir",
  "Chloe",
  "Diego",
  "Hannah",
  "Grace",
  "Omar",
  "Yuki",
];
const LAST = [
  "Nguyen",
  "Patel",
  "Garcia",
  "Kim",
  "Rossi",
  "Silva",
  "Haddad",
  "Osei",
  "Novak",
  "Reyes",
  "Cohen",
  "Ali",
  "Tremblay",
  "Costa",
  "Larsson",
  "Mbeki",
];

function rand(n: number) {
  return Math.floor(Math.random() * n);
}

function simulateZipPlan(fileName: string): ImportPlan {
  const validCount = 8 + rand(9); // 8–16 parseable resumes
  const needsCount = rand(3); // 0–2 resumes we couldn't parse
  const skipCount = rand(3); // 0–2 unsupported files
  const toCreate: NewApplicant[] = [];
  const imported: { name: string; email: string }[] = [];
  const used = new Set<string>();

  for (let i = 0; i < validCount; i++) {
    let name = "";
    do {
      name = `${FIRST[rand(FIRST.length)]} ${LAST[rand(LAST.length)]}`;
    } while (used.has(name));
    used.add(name);
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`;
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    toCreate.push({
      name,
      email,
      documents: [{ type: "resume", name: "Resume / CV", fileName: `${slug}-resume.pdf` }],
    });
    imported.push({ name, email });
  }

  const needsAttention: string[] = [];
  for (let i = 0; i < needsCount; i++) {
    const fn = `scan_${100 + i}.pdf`;
    needsAttention.push(fn);
    toCreate.push({
      name: "Unknown applicant",
      email: "",
      documents: [{ type: "resume", name: "Resume / CV", fileName: fn }],
    });
  }

  const skipPool = ["headshot.png", "portfolio.jpg", "notes.txt", "cover.rtf", "photo.gif"];
  const skippedFiles = skipPool.slice(0, skipCount);

  return { fileName, toCreate, imported, needsAttention, skippedFiles };
}

/* -------------------- Mode B: CSV -------------------- */
const CSV_HEADER = "full_name,email,phone,resume_url,cover_letter_url,notes";

function downloadTemplate() {
  const example =
    "Jane Doe,jane.doe@example.com,(555) 010-0100,https://drive.google.com/file/d/EXAMPLE/view,,Referred by Dr. Smith";
  const blob = new Blob([`${CSV_HEADER}\n${example}\n`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hireflow-applicants-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// Minimal RFC-4180-ish parser: handles quoted fields, escaped quotes, CRLF.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function buildCsvPlan(
  fileName: string,
  text: string,
): { plan: ImportPlan; preview: CsvPreviewRow[]; total: number } {
  const rows = parseCsv(text);
  const empty: ImportPlan = {
    fileName,
    toCreate: [],
    imported: [],
    needsAttention: [],
    skippedFiles: [],
  };
  if (rows.length < 2) return { plan: empty, preview: [], total: 0 };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (k: string) => header.indexOf(k);
  const iName = col("full_name");
  const iEmail = col("email");
  const iPhone = col("phone");
  const iResume = col("resume_url");
  const iCover = col("cover_letter_url");
  const iNotes = col("notes");
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  const preview: CsvPreviewRow[] = [];
  const toCreate: NewApplicant[] = [];
  const imported: { name: string; email: string }[] = [];
  const skippedFiles: string[] = [];

  rows.slice(1).forEach((r, n) => {
    const name = get(r, iName);
    const email = get(r, iEmail);
    const phone = get(r, iPhone) || undefined;
    const resume = get(r, iResume);
    const cover = get(r, iCover);
    const notes = get(r, iNotes) || undefined;
    const valid = name !== "" && email !== "";
    preview.push({ name, email, phone, resume, valid });
    if (valid) {
      const documents: ApplicantDocument[] = [];
      if (resume) documents.push({ type: "resume", name: "Resume / CV", fileName: resume });
      if (cover) documents.push({ type: "cover-letter", name: "Cover letter", fileName: cover });
      toCreate.push({ name, email, phone, notes, documents });
      imported.push({ name, email });
    } else {
      skippedFiles.push(`Row ${n + 1} (missing name or email)`);
    }
  });

  return {
    plan: { fileName, toCreate, imported, needsAttention: [], skippedFiles },
    preview,
    total: rows.length - 1,
  };
}

/* -------------------- Component -------------------- */
export function BulkImportDialog({
  open,
  onOpenChange,
  roleId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roleId: string;
}) {
  const { roles, currentUser } = useAppState();
  const role = roles.find((r) => r.id === roleId);

  const [tab, setTab] = useState("zip");
  const [zipFileName, setZipFileName] = useState<string | undefined>();
  const [zipPending, setZipPending] = useState<ImportPlan | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | undefined>();
  const [csv, setCsv] = useState<{
    plan: ImportPlan;
    preview: CsvPreviewRow[];
    total: number;
  } | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [plan, setPlan] = useState<ImportPlan | null>(null);

  useEffect(() => {
    if (open) {
      setTab("zip");
      setZipFileName(undefined);
      setZipPending(null);
      setCsvFileName(undefined);
      setCsv(null);
      setPhase("idle");
      setProgress(0);
      setPlan(null);
    }
  }, [open]);

  function runImport(p: ImportPlan) {
    setPlan(p);
    setProgress(0);
    setPhase("processing");
    const bulkImportId = actions.createBulkImport({
      roleId,
      fileName: p.fileName,
      importedBy: currentUser,
      totalFiles: p.imported.length + p.needsAttention.length + p.skippedFiles.length,
      successful: p.imported.length,
      failed: p.needsAttention.length,
      skipped: p.skippedFiles.length,
    });
    if (p.toCreate.length === 0) {
      setPhase("done");
      return;
    }
    let i = 0;
    const step = () => {
      const a = p.toCreate[i];
      actions.addApplicant({ ...a, roleId, source: "bulk_import", bulkImportId });
      i += 1;
      setProgress(i);
      if (i < p.toCreate.length) window.setTimeout(step, 130);
      else setPhase("done");
    };
    window.setTimeout(step, 200);
  }

  const percent =
    plan && plan.toCreate.length > 0 ? Math.round((progress / plan.toCreate.length) * 100) : 100;

  return (
    <Dialog open={open} onOpenChange={(v) => phase !== "processing" && onOpenChange(v)}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk import</DialogTitle>
          <DialogDescription>
            Add many applicants at once{role ? ` to ${role.title}` : ""}. Each imported applicant is
            screened automatically.
          </DialogDescription>
        </DialogHeader>

        {phase === "idle" && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="zip">ZIP of resumes</TabsTrigger>
              <TabsTrigger value="csv">CSV with details</TabsTrigger>
            </TabsList>

            <TabsContent value="zip" className="space-y-4 pt-2">
              <FileDropField
                label="Upload a ZIP file containing resume files (PDF or DOCX)"
                accept=".zip"
                hint="ZIP · max 50MB"
                fileName={zipFileName}
                onPick={() => {}}
                onPickFile={(f) => {
                  if (!f.name.toLowerCase().endsWith(".zip")) {
                    toast.error("Please select a .zip file.");
                    return;
                  }
                  if (f.size > 50 * 1024 * 1024) {
                    toast.error("ZIP files must be 50MB or smaller.");
                    return;
                  }
                  setZipFileName(f.name);
                  setZipPending(simulateZipPlan(f.name));
                }}
                onClear={() => {
                  setZipFileName(undefined);
                  setZipPending(null);
                }}
              />
              {zipPending && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {zipPending.imported.length +
                      zipPending.needsAttention.length +
                      zipPending.skippedFiles.length}{" "}
                    files detected.
                  </p>
                  <Button onClick={() => runImport(zipPending)}>Start import</Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="csv" className="space-y-4 pt-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  One applicant per row. Columns: {CSV_HEADER}
                </p>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4" /> Download template
                </Button>
              </div>
              <FileDropField
                label="Upload a CSV file"
                accept=".csv"
                hint="CSV"
                fileName={csvFileName}
                onPick={() => {}}
                onPickFile={(f) => {
                  if (!f.name.toLowerCase().endsWith(".csv")) {
                    toast.error("Please select a .csv file.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    const built = buildCsvPlan(f.name, String(reader.result ?? ""));
                    if (built.total === 0) {
                      toast.error("No data rows found in the CSV.");
                      return;
                    }
                    setCsvFileName(f.name);
                    setCsv(built);
                  };
                  reader.onerror = () => toast.error("Couldn't read the CSV file.");
                  reader.readAsText(f);
                }}
                onClear={() => {
                  setCsvFileName(undefined);
                  setCsv(null);
                }}
              />
              {csv && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Ready to import {csv.plan.imported.length} of {csv.total} applicants. Review
                    below.
                  </p>
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/40 text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Email</th>
                          <th className="px-3 py-2 font-medium">Phone</th>
                          <th className="px-3 py-2 font-medium">Resume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csv.preview.slice(0, 5).map((r, i) => (
                          <tr
                            key={i}
                            className={cn("border-t border-border", !r.valid && "bg-danger-muted")}
                          >
                            <td className="px-3 py-2">
                              {r.name || <span className="text-danger">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              {r.email || <span className="text-danger">—</span>}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{r.phone || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {r.resume ? "Linked" : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {csv.plan.skippedFiles.length > 0 && (
                    <p className="text-xs text-danger">
                      {csv.plan.skippedFiles.length} row(s) missing name or email will be skipped.
                    </p>
                  )}
                  <Button
                    onClick={() => runImport(csv.plan)}
                    disabled={csv.plan.imported.length === 0}
                  >
                    Confirm import
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {phase === "processing" && plan && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing {plan.toCreate.length} applicants… {progress} processed
            </div>
            <Progress value={percent} />
            <p className="text-xs text-muted-foreground">
              Screening runs automatically as each applicant is created.
            </p>
          </div>
        )}

        {phase === "done" && plan && <ResultsSummary plan={plan} />}

        <DialogFooter>
          {phase === "done" ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={phase === "processing"}
            >
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultsSummary({ plan }: { plan: ImportPlan }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-success/25 bg-success-muted p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" /> Successfully imported: {plan.imported.length}
        </div>
        {plan.imported.length > 0 && (
          <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs text-foreground">
            {plan.imported.map((a, i) => (
              <li key={i}>
                {a.name} <span className="text-muted-foreground">· {a.email}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {plan.needsAttention.length > 0 && (
        <div className="rounded-md border border-warning/25 bg-warning-muted p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="h-4 w-4" /> Needs attention: {plan.needsAttention.length}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Couldn't read contact info — open each applicant to fill in the missing details.
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-foreground">
            {plan.needsAttention.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {plan.skippedFiles.length > 0 && (
        <div className="rounded-md border border-border bg-secondary/40 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <XCircle className="h-4 w-4" /> Skipped: {plan.skippedFiles.length}
          </div>
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {plan.skippedFiles.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
