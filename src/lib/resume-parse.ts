/**
 * Best-effort resume parsing to prefill the applicant Name + Email fields.
 * Extracts plain text from PDF / DOCX / TXT resumes (all client-side), then
 * applies simple heuristics — no AI. Results are guesses: callers show them in an
 * editable review step, and either field may come back "" when we aren't confident.
 */

// Matches virtually every resume email. Case-insensitive.
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

// Lines that are never a person's name: document headings and common job titles.
// Compared case-insensitively against the whole trimmed line.
const NAME_BLACKLIST = new Set([
  "resume",
  "résumé",
  "cv",
  "curriculum vitae",
  "professional summary",
  "summary",
  "profile",
  "objective",
  "contact",
  "contact information",
  "software engineer",
  "frontend developer",
  "backend developer",
  "full stack developer",
  "web developer",
  "product manager",
  "data scientist",
]);

// "JOHN MICHAEL DOE" -> "John Michael Doe", "garcía-lópez" -> "García-López".
// Uppercases the first letter of each word. Word starts are defined explicitly (start
// of string, or after a space / hyphen / apostrophe) because JS `\b` is ASCII-only and
// would mis-fire on accented letters like "í".
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** First line that reads like a person's name (2–4 alphabetic words). "" if none. */
function guessName(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (NAME_BLACKLIST.has(line.toLowerCase())) continue;
    if (/[\d@]/.test(line)) continue; // numbers or emails aren't names

    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;
    if (!words.every((w) => /^[\p{L}.'-]+$/u.test(w))) continue;

    const formatted = titleCase(line);
    if (NAME_BLACKLIST.has(formatted.toLowerCase())) continue; // e.g. "SOFTWARE ENGINEER"
    return formatted;
  }
  return "";
}

/** Pull name + email out of extracted resume text. Either may be "" if not found. */
export function parseNameEmail(text: string): { name: string; email: string } {
  return {
    name: guessName(text),
    email: text.match(EMAIL_RE)?.[0]?.toLowerCase() ?? "",
  };
}

/* -------------------- Text extraction (browser-only, lazy-loaded) -------------------- */

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Vite-bundled worker URL; set once per session.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = (
      await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
    ).default;
  }
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  // Name + email live at the top; cap pages so long resumes stay fast.
  const pageCount = Math.min(doc.numPages, 2);
  let text = "";
  for (let p = 1; p <= pageCount; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items) {
      // TextItem has str/hasEOL; TextMarkedContent (no `str`) is skipped.
      if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
    }
  }
  return text;
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value;
}

/**
 * Extract plain text from a resume file. Supports .pdf, .docx and .txt.
 * Rejects on unsupported types (e.g. legacy .doc) or unreadable files — callers
 * should catch and fall back to a filename-based guess.
 */
export async function extractResumeText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return extractPdf(file);
  if (name.endsWith(".docx")) return extractDocx(file);
  if (name.endsWith(".txt")) return file.text();
  throw new Error(`Unsupported resume file type: ${file.name}`);
}
