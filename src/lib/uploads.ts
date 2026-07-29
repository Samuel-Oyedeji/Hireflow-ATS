import { extractResumeText } from "./resume-parse";
import { uploadFileFn } from "./data";
import type { DocInput } from "./data";
import type { ApplicantDocument } from "./types";

/**
 * Client-side prep for a picked file: store the original in Supabase Storage and
 * extract its text for AI screening. Both are best-effort — a failed upload or an
 * unreadable file still lets the applicant be created (screening just has less to
 * work with). Runs the two in parallel.
 */
export async function prepareDocument(
  file: File,
  meta: { name: string; type: ApplicantDocument["type"] },
  folder: string,
  knownText?: string,
): Promise<DocInput> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);

  // `knownText` lets callers that already extracted the text (e.g. the bulk-import
  // preview) skip re-parsing the file.
  const [uploaded, text] = await Promise.all([
    uploadFileFn({ data: form }).catch(() => undefined),
    knownText !== undefined ? Promise.resolve(knownText) : extractResumeText(file).catch(() => ""),
  ]);

  return {
    name: meta.name,
    type: meta.type,
    fileName: file.name,
    storagePath: uploaded?.storagePath,
    text: text || undefined,
  };
}

/** Upload a file and return just its extracted text + storage path (for transcripts). */
export async function prepareTranscript(
  file: File,
  folder: string,
): Promise<{ storagePath?: string; text: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);

  const [uploaded, text] = await Promise.all([
    uploadFileFn({ data: form }).catch(() => undefined),
    extractResumeText(file).catch(() => ""),
  ]);

  return { storagePath: uploaded?.storagePath, text };
}
