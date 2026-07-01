import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  Info,
  Loader2,
  Plus,
  Upload,
  X,
  XCircle,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDropField } from "@/components/file-drop-field";
import { cn } from "@/lib/utils";
import { actions, useAppState } from "@/lib/store";
import { extractResumeText, parseNameEmail } from "@/lib/resume-parse";
import type { ApplicantDocument } from "@/lib/types";

/** An editable, not-yet-committed applicant row shown in the review step. */
type EditRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  documents: ApplicantDocument[];
  source: string; // originating file name or CSV row label
};

type Phase = "idle" | "processing" | "done";
type Result = { imported: { name: string; email: string }[]; skipped: string[] };

const uid = () => Math.random().toString(36).slice(2, 9);

/* -------------------- Mode A: resume files -------------------- */
// Each file's text is extracted client-side (see resume-parse) and the real name +
// email are pulled from it. If extraction fails or finds no name we fall back to a
// guess from the file name; email is left blank rather than fabricated. HR edits both.
function nameFromFilename(fileName: string): string {
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\b(cv|resume|résumé|curriculum|vitae|application|final|copy|updated?|v\d+)\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

async function rowsFromFiles(files: File[]): Promise<{ rows: EditRow[]; skipped: string[] }> {
  const rows: EditRow[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    if (!/\.(pdf|docx?|txt)$/i.test(f.name)) {
      skipped.push(f.name);
      continue;
    }
    const fallbackName = nameFromFilename(f.name);
    let name = fallbackName;
    let email = "";
    try {
      const parsed = parseNameEmail(await extractResumeText(f));
      name = parsed.name || fallbackName;
      email = parsed.email;
    } catch {
      // Unreadable or unsupported (e.g. legacy .doc) — keep the filename guess.
    }
    rows.push({
      id: uid(),
      name,
      email,
      phone: "",
      notes: "",
      documents: [{ type: "resume", name: "Resume / CV", fileName: f.name }],
      source: f.name,
    });
  }
  return { rows, skipped };
}

/* -------------------- Mode B: CSV (flexible column mapping) -------------------- */
const CSV_TEMPLATE_HEADER = "full_name,email,phone,resume_url,cover_letter_url,notes";

function downloadTemplate() {
  const example =
    "Jane Doe,jane.doe@example.com,(555) 010-0100,https://drive.google.com/file/d/EXAMPLE/view,,Referred by Dr. Smith";
  const blob = new Blob([`${CSV_TEMPLATE_HEADER}\n${example}\n`], { type: "text/csv" });
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

// Best-effort header mapping — the schema is unpredictable, so we match loosely and
// fall back to detecting the email column by its content (an "@").
function rowsFromCsv(text: string): EditRow[] {
  const table = parseCsv(text);
  if (table.length < 2) return [];
  const header = table[0].map((h) => h.trim().toLowerCase());
  const data = table.slice(1);
  const find = (keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));

  const cols = {
    name: find(["full_name", "fullname", "full name", "name", "candidate", "applicant"]),
    email: find(["email", "e-mail", "mail"]),
    phone: find(["phone", "mobile", "tel", "cell", "contact"]),
    resume: find(["resume", "cv", "résumé"]),
    cover: find(["cover"]),
    notes: find(["note", "comment", "remark"]),
  };
  if (cols.email < 0) {
    for (let c = 0; c < header.length; c++) {
      if (data.some((r) => (r[c] ?? "").includes("@"))) {
        cols.email = c;
        break;
      }
    }
  }
  if (cols.name < 0) {
    cols.name = header.findIndex((_, c) => c !== cols.email);
  }

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  return data.map((r, n) => {
    const documents: ApplicantDocument[] = [];
    const resume = get(r, cols.resume);
    const cover = get(r, cols.cover);
    if (resume) documents.push({ type: "resume", name: "Resume / CV", fileName: resume });
    if (cover) documents.push({ type: "cover-letter", name: "Cover letter", fileName: cover });
    return {
      id: uid(),
      name: get(r, cols.name),
      email: get(r, cols.email),
      phone: get(r, cols.phone),
      notes: get(r, cols.notes),
      documents,
      source: `Row ${n + 1}`,
    };
  });
}

/* -------------------- Component -------------------- */
export function BulkImportDialog({
  open,
  onOpenChange,
  roleId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roleId?: string;
}) {
  const { roles, currentUser } = useAppState();
  const openRoles = roles.filter((r) => r.status === "open");

  const [selectedRoleId, setSelectedRoleId] = useState(roleId ?? "");
  const effectiveRoleId = roleId ?? selectedRoleId;
  const role = roles.find((r) => r.id === effectiveRoleId);

  const [tab, setTab] = useState("files");
  const [csvName, setCsvName] = useState<string | undefined>();
  const [rows, setRows] = useState<EditRow[] | null>(null);
  const [preSkipped, setPreSkipped] = useState<string[]>([]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [parsing, setParsing] = useState(false);
  const addFilesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedRoleId(roleId ?? "");
      setTab("files");
      setCsvName(undefined);
      setRows(null);
      setPreSkipped([]);
      setPhase("idle");
      setProgress(0);
      setResult(null);
      setParsing(false);
    }
  }, [open, roleId]);

  // Reads each file, extracts name/email, and appends the review rows. Used for both
  // the initial drop (rows === null, so it starts fresh) and the "Add files" button.
  async function addFiles(files: File[]) {
    setParsing(true);
    try {
      const { rows: r, skipped } = await rowsFromFiles(files);
      if (r.length === 0 && skipped.length === 0) return;
      if (r.length === 0) toast.error("No PDF, DOCX, or TXT resumes found in your selection.");
      if (r.length) setRows((prev) => [...(prev ?? []), ...r]);
      if (skipped.length) setPreSkipped((prev) => [...prev, ...skipped]);
    } finally {
      setParsing(false);
    }
  }

  function updateRow(id: string, patch: Partial<EditRow>) {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? prev);
  }
  function removeRow(id: string) {
    setRows((prev) => prev?.filter((r) => r.id !== id) ?? prev);
  }

  const validCount = rows ? rows.filter((r) => r.name.trim() && r.email.trim()).length : 0;

  function runImport() {
    if (!rows) return;
    if (!effectiveRoleId) return toast.error("Select a role first.");
    const valid = rows.filter((r) => r.name.trim() && r.email.trim());
    const invalid = rows.filter((r) => !(r.name.trim() && r.email.trim()));
    const skipped = [...preSkipped, ...invalid.map((r) => `${r.source} (missing name or email)`)];
    const fileName =
      tab === "csv" ? (csvName ?? "import.csv") : `${valid.length + skipped.length} resume files`;

    const bulkImportId = actions.createBulkImport({
      roleId: effectiveRoleId,
      fileName,
      importedBy: currentUser,
      totalFiles: valid.length + skipped.length,
      successful: valid.length,
      failed: 0,
      skipped: skipped.length,
    });

    setResult({
      imported: valid.map((r) => ({ name: r.name.trim(), email: r.email.trim() })),
      skipped,
    });
    setProgress(0);
    setPhase("processing");
    if (valid.length === 0) {
      setPhase("done");
      return;
    }
    let i = 0;
    const step = () => {
      const r = valid[i];
      actions.addApplicant({
        name: r.name.trim(),
        email: r.email.trim(),
        phone: r.phone.trim() || undefined,
        notes: r.notes.trim() || undefined,
        documents: r.documents,
        roleId: effectiveRoleId,
        source: "bulk_import",
        bulkImportId,
      });
      i += 1;
      setProgress(i);
      if (i < valid.length) window.setTimeout(step, 120);
      else setPhase("done");
    };
    window.setTimeout(step, 200);
  }

  const percent =
    result && result.imported.length > 0
      ? Math.round((progress / result.imported.length) * 100)
      : 100;

  return (
    <Dialog open={open} onOpenChange={(v) => phase !== "processing" && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk import</DialogTitle>
          <DialogDescription>
            Add many applicants at once{role ? ` to ${role.title}` : ""}. Each imported applicant is
            screened automatically.
          </DialogDescription>
        </DialogHeader>

        {phase === "idle" && !roleId && (
          <div className="space-y-1.5">
            <Label>Role applied for</Label>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {openRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedRoleId && (
              <p className="flex items-center gap-1.5 text-xs text-warning">
                <Info className="h-3.5 w-3.5 shrink-0" /> Select a role before importing.
              </p>
            )}
          </div>
        )}

        {phase === "idle" && rows === null && parsing && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading resumes…
          </div>
        )}

        {phase === "idle" && rows === null && !parsing && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="files">Resume files</TabsTrigger>
              <TabsTrigger value="csv">CSV</TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="space-y-3 pt-2">
              <MultiFileDrop onFiles={addFiles} />
              <p className="text-xs text-muted-foreground">
                We'll pull a name and email from each file — you can edit them before importing.
              </p>
            </TabsContent>

            <TabsContent value="csv" className="space-y-3 pt-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Upload a CSV with any columns — we'll map name, email, phone and notes
                  automatically.
                </p>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4" /> Template
                </Button>
              </div>
              <FileDropField
                label="CSV file"
                accept=".csv"
                hint="CSV"
                fileName={csvName}
                onPick={() => {}}
                onPickFile={(f) => {
                  if (!f.name.toLowerCase().endsWith(".csv")) {
                    toast.error("Please select a .csv file.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    const r = rowsFromCsv(String(reader.result ?? ""));
                    if (r.length === 0) {
                      toast.error("No data rows found in the CSV.");
                      return;
                    }
                    setCsvName(f.name);
                    setPreSkipped([]);
                    setRows(r);
                  };
                  reader.onerror = () => toast.error("Couldn't read the CSV file.");
                  reader.readAsText(f);
                }}
                onClear={() => setCsvName(undefined)}
              />
            </TabsContent>
          </Tabs>
        )}

        {phase === "idle" && rows !== null && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Review {rows.length} applicant{rows.length === 1 ? "" : "s"} — edit any name or
                email before importing.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={parsing}
                onClick={() => addFilesRef.current?.click()}
              >
                {parsing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}{" "}
                Add files
              </Button>
              <input
                ref={addFilesRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  const fs = Array.from(e.target.files ?? []);
                  e.currentTarget.value = "";
                  if (fs.length) addFiles(fs);
                }}
              />
            </div>
            <div className="space-y-2">
              {rows.map((r) => {
                const primaryDoc = r.documents.find((d) => d.type === "resume") ?? r.documents[0];
                const docTitle = primaryDoc?.fileName ?? r.source;
                const docSub = primaryDoc ? "Resume / CV" : "No attached file";
                return (
                  <div
                    key={r.id}
                    className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-start"
                  >
                    {/* Document */}
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-secondary/40 px-3 py-2">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-medium text-foreground"
                          title={docTitle}
                        >
                          {docTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">{docSub}</p>
                      </div>
                    </div>
                    {/* Extracted name + email */}
                    <div className="flex-1 space-y-2">
                      <Input
                        value={r.name}
                        placeholder="Full name"
                        onChange={(e) => updateRow(r.id, { name: e.target.value })}
                      />
                      <Input
                        value={r.email}
                        placeholder="email@example.com"
                        onChange={(e) => updateRow(r.id, { email: e.target.value })}
                      />
                    </div>
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => removeRow(r.id)}
                      className="shrink-0 self-center text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            {preSkipped.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {preSkipped.length} unsupported file{preSkipped.length === 1 ? "" : "s"} will be
                skipped.
              </p>
            )}
            {validCount < rows.length && (
              <p className="text-xs text-danger">Rows missing a name or email won't be imported.</p>
            )}
          </div>
        )}

        {phase === "processing" && result && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing {result.imported.length} applicants… {progress} processed
            </div>
            <Progress value={percent} />
            <p className="text-xs text-muted-foreground">
              Screening runs automatically as each applicant is created.
            </p>
          </div>
        )}

        {phase === "done" && result && <ResultsSummary result={result} />}

        <DialogFooter>
          {phase === "done" ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : phase === "processing" ? (
            <Button variant="ghost" disabled>
              Importing…
            </Button>
          ) : rows ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={runImport} disabled={validCount === 0 || !effectiveRoleId}>
                Import {validCount} applicant{validCount === 1 ? "" : "s"}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MultiFileDrop({ onFiles }: { onFiles: (files: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const fs = Array.from(e.dataTransfer.files ?? []);
        if (fs.length) onFiles(fs);
      }}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed px-3 py-8 text-sm transition-colors",
        drag ? "border-primary bg-accent" : "border-border bg-card hover:bg-secondary/50",
      )}
    >
      <Upload className="h-5 w-5 text-muted-foreground" />
      <span className="text-center text-muted-foreground">
        Drag &amp; drop or <span className="text-primary">browse</span> — select multiple resume
        files (PDF, DOCX or TXT)
      </span>
      <input
        ref={ref}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(e) => {
          const fs = Array.from(e.target.files ?? []);
          e.currentTarget.value = "";
          if (fs.length) onFiles(fs);
        }}
      />
    </button>
  );
}

function ResultsSummary({ result }: { result: Result }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-success/25 bg-success-muted p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" /> Imported: {result.imported.length}
        </div>
        {result.imported.length > 0 && (
          <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs text-foreground">
            {result.imported.map((a, i) => (
              <li key={i}>
                {a.name} <span className="text-muted-foreground">· {a.email}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {result.skipped.length > 0 && (
        <div className="rounded-md border border-border bg-secondary/40 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <XCircle className="h-4 w-4" /> Skipped: {result.skipped.length}
          </div>
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {result.skipped.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
