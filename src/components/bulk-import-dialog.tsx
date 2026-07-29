import { useEffect, useRef, useState } from "react";
import { Download, FileText, Info, Loader2, Plus, Upload, X } from "lucide-react";
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
import { prepareDocument } from "@/lib/uploads";
import { extractResumeText, parseNameEmail } from "@/lib/resume-parse";
import type { ApplicantDocument } from "@/lib/types";
import type { DocInput } from "@/lib/data";

/** An editable, not-yet-committed applicant row shown in the review step. */
type EditRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  documents: ApplicantDocument[];
  source: string; // originating file name or CSV row label
  file?: File; // the resume file (Mode A) — uploaded and screened on import
  resumeText?: string; // text already extracted for the name/email preview
  unreadable?: boolean; // extraction yielded no usable text (e.g. a screenshot-only PDF)
};

const uid = () => Math.random().toString(36).slice(2, 9);

// Summary handed back to the dialog when an import finishes, so it can show the
// skipped rows in a follow-up modal. `skipped` entries are file/row labels.
type ImportSummary = { imported: number; failed: number; skipped: string[] };

// How many applicants to screen in parallel during a bulk import. Each is one
// OpenRouter call; 5 balances speed against rate limits.
const IMPORT_CONCURRENCY = 3;

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
    let resumeText: string | undefined;
    let unreadable = false;
    try {
      resumeText = await extractResumeText(f);
      const parsed = parseNameEmail(resumeText);
      name = parsed.name || fallbackName;
      email = parsed.email;
      // Image-only PDFs (e.g. a screenshotted resume) carry no text layer, so
      // extraction returns next to nothing and there's nothing to prefill from.
      if (resumeText.replace(/\s/g, "").length < 10) unreadable = true;
    } catch {
      // Unreadable or unsupported (e.g. legacy .doc) — keep the filename guess.
      unreadable = true;
    }
    rows.push({
      id: uid(),
      name,
      email,
      phone: "",
      notes: "",
      documents: [{ type: "resume", name: "Resume / CV", fileName: f.name }],
      source: f.name,
      file: f,
      resumeText,
      unreadable,
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

/* -------------------- Background import -------------------- */
// Build the documents to persist for a row: Mode A rows carry a real file (uploaded +
// its already-extracted text is reused for screening); CSV rows only have URL references,
// so they're stored as metadata with no text (screening notes the missing documents).
async function docsForRow(r: EditRow): Promise<DocInput[]> {
  if (r.file) {
    return [
      await prepareDocument(r.file, { name: "Resume / CV", type: "resume" }, "resumes", r.resumeText),
    ];
  }
  return r.documents.map((d) => ({ name: d.name, type: d.type, fileName: d.fileName }));
}

// Runs the whole import in the background, driven entirely by a top-right Sonner toast.
// It holds no React state and captures everything it needs up front, so it keeps going
// (and keeps updating the toast) after HR closes the dialog and works elsewhere.
async function runBulkImport(params: {
  validRows: EditRow[];
  skipped: string[];
  roleId: string;
  fileName: string;
  importedBy: string;
  onFinished: (summary: ImportSummary) => void;
}) {
  const { validRows, skipped, roleId, fileName, importedBy, onFinished } = params;
  const total = validRows.length;
  const noun = (n: number) => `applicant${n === 1 ? "" : "s"}`;
  const toastId = toast.loading(`Importing 0 of ${total} ${noun(total)}…`, {
    position: "top-right",
    duration: Infinity,
  });

  try {
    const bulkImportId = await actions.createBulkImport({
      roleId,
      fileName,
      importedBy,
      totalFiles: total + skipped.length,
      successful: total,
      failed: 0,
      skipped: skipped.length,
    });

    // Screen up to IMPORT_CONCURRENCY applicants at once. Each is an independent
    // OpenRouter call, so a small pool cuts wall-clock time without hammering the API.
    // A shared cursor hands each worker the next row.
    let done = 0;
    let failed = 0;
    let cursor = 0;
    async function worker() {
      while (cursor < total) {
        const r = validRows[cursor++];
        try {
          await actions.addApplicant({
            name: r.name.trim(),
            email: r.email.trim(),
            phone: r.phone.trim() || undefined,
            notes: r.notes.trim() || undefined,
            documents: await docsForRow(r),
            roleId,
            source: "bulk_import",
            bulkImportId,
          });
        } catch {
          // Keep going — a single screening failure shouldn't abort the whole import.
          failed++;
        }
        done++;
        toast.loading(`Importing ${done} of ${total} ${noun(total)}…`, {
          id: toastId,
          position: "top-right",
        });
      }
    }
    await Promise.all(Array.from({ length: Math.min(IMPORT_CONCURRENCY, total) }, worker));

    const imported = total - failed;
    toast.success(
      `Imported ${imported} ${noun(imported)}` +
        (skipped.length ? ` · ${skipped.length} skipped` : "") +
        (failed ? ` · ${failed} failed` : ""),
      { id: toastId, position: "top-right", duration: 6000 },
    );
    if (skipped.length) onFinished({ imported, failed, skipped });
  } catch {
    toast.error("Bulk import failed. Please try again.", {
      id: toastId,
      position: "top-right",
      duration: 6000,
    });
  }
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

  const [parsing, setParsing] = useState(false);
  // Set when a background import finishes with skipped rows — drives the follow-up modal.
  const [skippedInfo, setSkippedInfo] = useState<ImportSummary | null>(null);
  const addFilesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedRoleId(roleId ?? "");
      setTab("files");
      setCsvName(undefined);
      setRows(null);
      setPreSkipped([]);
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

  // Kick off the import in the background and close the dialog immediately — progress
  // and the final summary live in a top-right toast, so HR can keep working meanwhile.
  function runImport() {
    if (!rows) return;
    if (!effectiveRoleId) return toast.error("Select a role first.");
    const valid = rows.filter((r) => r.name.trim() && r.email.trim());
    const invalid = rows.filter((r) => !(r.name.trim() && r.email.trim()));
    const skipped = [...preSkipped, ...invalid.map((r) => `${r.source} (missing name or email)`)];
    if (valid.length === 0)
      return toast.error("Add at least one applicant with a name and email.");
    const fileName =
      tab === "csv" ? (csvName ?? "import.csv") : `${valid.length + skipped.length} resume files`;

    onOpenChange(false);
    void runBulkImport({
      validRows: valid,
      skipped,
      roleId: effectiveRoleId,
      fileName,
      importedBy: currentUser,
      onFinished: setSkippedInfo,
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk import</DialogTitle>
          <DialogDescription>
            Add many applicants at once{role ? ` to ${role.title}` : ""}. Each imported applicant is
            screened automatically.
          </DialogDescription>
        </DialogHeader>

        {!roleId && (
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

        {rows === null && parsing && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading resumes…
          </div>
        )}

        {rows === null && !parsing && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="files">Resume files</TabsTrigger>
              <TabsTrigger value="csv" disabled className="gap-1.5">
                CSV
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Soon
                </span>
              </TabsTrigger>
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

        {rows !== null && (
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
                      {r.unreadable && (
                        <p className="flex items-center gap-1.5 text-xs text-warning">
                          <Info className="h-3.5 w-3.5 shrink-0" /> Couldn't read this file — please
                          fill in manually.
                        </p>
                      )}
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

        <DialogFooter>
          {rows ? (
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

      <Dialog open={skippedInfo !== null} onOpenChange={(v) => !v && setSkippedInfo(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import complete</DialogTitle>
            <DialogDescription>
              {skippedInfo &&
                `Imported ${skippedInfo.imported} · ${skippedInfo.skipped.length} skipped` +
                  (skippedInfo.failed ? ` · ${skippedInfo.failed} failed` : "")}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <p className="mb-2 text-sm font-semibold text-foreground">
              Skipped {skippedInfo?.skipped.length ?? 0}
            </p>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-xs text-muted-foreground">
              {skippedInfo?.skipped.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <X className="mt-0.5 h-3 w-3 shrink-0 text-danger" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={() => setSkippedInfo(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
