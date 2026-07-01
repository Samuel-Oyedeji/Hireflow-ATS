# HireFlow — Feature Implementation Spec
## Addendum to PRD: Applicant Intake Improvements + Interview Transcript Analysis

This document extends the main HireFlow PRD with three new features. The core data model and flow described in the PRD remain unchanged — these are additive. Implement each section independently; they do not depend on each other.

---

## Feature 1: Public Application Form (per role)

### What it is
Every role gets a public, unauthenticated URL that applicants can use to self-submit. The clinic shares this link wherever they post the job (WhatsApp, website, email, job boards). Submissions create an `Applicant` record and trigger AI screening automatically — no HR manual upload required.

### URL structure
```
/apply/[roleId]
```
This route must be fully public — no auth middleware, no login redirect. It should render cleanly with no sidebar, no HR nav, no internal UI chrome. Just the application form.

### Page behaviour
- On load, fetch the role by `roleId`. If the role's `status` is `closed` or the role doesn't exist, show a simple message: "This position is no longer accepting applications." with the clinic name. Do not 404 — applicants shouldn't see a broken page.
- If the role is `open`, render the form.
- Show the role title and department at the top so the applicant knows what they're applying for (e.g. "Applying for: Massage Therapist — Rehabilitation").

### Form fields
| Field | Type | Required |
|---|---|---|
| Full name | Text input | Yes |
| Email address | Email input | Yes |
| Phone number | Text input | No |
| Resume / CV | File upload | Yes — PDF or DOCX only |
| Cover letter | File upload | No — PDF or DOCX only |
| Supporting document | File upload | No — PDF or DOCX only |

- File inputs should be clearly labelled with accepted formats (PDF, DOCX) and a max size (10MB per file is reasonable).
- No CAPTCHA needed for v1, but add a honeypot field (hidden input) to catch basic spam bots without friction.
- Submit button label: "Submit application"

### On submission
1. Validate all required fields client-side before sending.
2. Upload files to object storage (same storage setup used elsewhere in the app) and get back URLs.
3. Create an `Applicant` record with status `uploaded`.
4. Create `ApplicantDocument` records for each uploaded file, linked to the applicant.
5. Immediately trigger the AI screening job (same logic used by the existing manual upload flow) — the applicant should enter the HR dashboard already screened, not waiting.
6. Show a success state on the page: "Your application has been submitted. We'll be in touch if you're shortlisted." Do not redirect — keep them on the same page with a confirmation message. Do not show any internal data (score, decision, etc.).
7. If submission fails, show a clear error and let them retry without losing their form data.

### HR side: shareable link
- On the Role Detail page, add a "Copy application link" button next to the role title. Clicking it copies the full public URL to clipboard and shows a brief "Link copied" tooltip.
- Also show the link as plain text so HR can manually paste it. 
- This is the only change needed to the existing HR UI for this feature.

### Data model: no changes needed
The `Applicant` and `ApplicantDocument` tables from the main PRD already support this. The only difference from manual upload is that `source` should be tracked — add a `source` field to `Applicant`:

```
source: enum — 'manual_upload' | 'public_form' | 'bulk_import'
```

This is useful later for reporting ("where are our best hires coming from").

---

## Feature 2: Bulk Resume Import (ZIP + CSV)

### What it is
HR can upload a batch of applicants in one action rather than one at a time. Two sub-modes:

**Mode A — ZIP of resume files**
HR drops a ZIP file containing multiple resume/CV PDFs or DOCXs. The system unpacks it, creates one applicant profile per file, parses contact info from each document, and queues all of them for AI screening.

**Mode B — CSV with metadata + file links**
HR uploads a CSV where each row is an applicant. Columns map to applicant fields. Resume files can be referenced either as Google Drive links or as filenames matching files in a simultaneously uploaded ZIP.

### Where it lives in the UI
On the Role Detail page, the existing "+ Upload Applicant" button becomes a dropdown with two options:
- "Add single applicant" → existing manual upload modal (unchanged)
- "Bulk import" → opens the bulk import modal (new)

### Bulk import modal — Mode A (ZIP upload)

**Step 1: Upload**
- Single drag-and-drop zone accepting `.zip` files only, max 50MB.
- Label: "Upload a ZIP file containing resume files (PDF or DOCX)"
- Show file count preview once ZIP is selected: "23 files detected"

**Step 2: Processing (server-side)**
When the ZIP is received:
1. Unpack the archive server-side.
2. For each file (skip non-PDF/DOCX files silently, log them):
   a. Extract text content from the document.
   b. Use an LLM call (or a lightweight regex pass first, LLM as fallback) to extract: full name, email address, phone number.
   c. Create an `Applicant` record with `source: 'bulk_import'`, `status: 'uploaded'`, name/email/phone from extraction, linked to the current role.
   d. Create an `ApplicantDocument` record of type `resume` linked to that applicant.
3. Queue all created applicants for AI screening (can be batched, but each gets their own `ScreeningResult`).

**Step 3: Results summary (shown in modal after processing)**
Show a table:
- ✅ Successfully imported: X applicants (list with name + email extracted)
- ⚠️ Needs attention: Y applicants where name/email couldn't be extracted (list with filename — HR can click to manually fill in missing info)
- ❌ Skipped: Z files (unsupported format — list filenames)

HR can close the modal and the imported applicants appear in the role's applicant list immediately, with screening running in the background.

### Bulk import modal — Mode B (CSV import)

**CSV template**
Provide a downloadable CSV template from the modal ("Download template"). Columns:

```
full_name, email, phone, resume_url, cover_letter_url, notes
```

- `resume_url` and `cover_letter_url` can be Google Drive share links, Dropbox links, or direct file URLs. The system will attempt to fetch and store them.
- `notes` is an optional free-text field HR can use internally (not shown to applicants, stored on the `Applicant` record).
- All columns except `full_name` and `email` are optional.

**Upload flow**
1. HR uploads the CSV.
2. System parses it and shows a preview table (first 5 rows + total count): "Ready to import 18 applicants. Review below."
3. Highlight any rows with missing required fields (name or email) in red, with a note: "These rows will be skipped."
4. "Confirm import" button creates all valid `Applicant` records and queues screening.
5. For rows where resume_url is provided: attempt to fetch the file in the background. If fetch fails, flag the applicant as needing document upload, but still create the profile and attempt screening on whatever is available.

### Processing: async/queue behaviour
Bulk imports should not block the UI. Once HR confirms the import:
- Show a progress indicator on the Role Detail page: "Importing 23 applicants... 14 screened so far"
- Applicants appear in the list as they're processed, with status updating from `uploaded` → `screened` in real time (use polling or a simple server-sent event).
- If screening fails for any applicant, mark them with a "Screening failed — retry" action rather than silently dropping them.

### Data model additions
Add to `Applicant`:
```
source: enum — 'manual_upload' | 'public_form' | 'bulk_import'  (same as Feature 1)
notes: text — nullable, internal HR note
bulk_import_id: uuid — nullable, FK to a BulkImport record (groups applicants from the same import)
```

Add a `BulkImport` table to track each batch:
```
id: uuid
role_id: uuid (FK)
imported_by: string
file_name: string
total_files: integer
successful: integer
failed: integer
skipped: integer
created_at: timestamp
```

This lets HR see a history of imports and investigate failures.

---

## Feature 3: Interview Transcript Upload + AI Hiring Suggestion

### What it is
After an interview has taken place, HR uploads a transcript of the interview (text file, DOCX, or PDF). The system runs an AI analysis on it — in context of the role's criteria and the applicant's earlier screening result — and produces a structured hiring suggestion: hire, reject, or further review, with a written rationale. HR can confirm or override this, just like the screening step.

### Where this fits in the flow
This is a new stage that sits after `invited` in the applicant lifecycle. The updated status flow is:

```
uploaded → screened → reviewed → invited → interviewed → decided
```

Add these two values to the `Applicant.status` enum:
- `interviewed` — transcript has been uploaded and analysed
- `decided` — final hire/reject/hold decision has been recorded

### UI: where transcript upload lives
On the Applicant Review page, once an applicant's status is `invited` or later, show a new section below the existing screening result card:

**Section title: "Interview"**
- If no transcript yet: show an upload zone — "Upload interview transcript (PDF, DOCX, or TXT)" with a "Analyse transcript" button.
- If transcript is uploaded and analysis is running: show a loading state — "Analysing transcript..."
- If analysis is complete: show the Transcript Analysis card (see below).

### Transcript analysis: AI prompt design
When the transcript is uploaded, send to the LLM:

**Context provided:**
1. The role title and department
2. The role's screening criteria (label, description, importance — same as used for resume screening)
3. The applicant's original screening result: score, AI decision, reasoning, and criteria breakdown
4. The full text of the interview transcript

**Output required (structured JSON):**
```json
{
  "overall_suggestion": "hire" | "reject" | "further_review",
  "confidence": "high" | "medium" | "low",
  "summary": "2-3 sentence plain-language summary of the interview performance",
  "strengths": ["string", "string"],
  "concerns": ["string", "string"],
  "criteria_update": [
    {
      "criterion_id": "uuid",
      "original_assessment": "met" | "not_met" | "unclear",
      "updated_assessment": "met" | "not_met" | "unclear",
      "note": "what the interview revealed about this criterion"
    }
  ],
  "suggested_next_step": "string — plain language e.g. 'Proceed to offer' or 'Request a second interview to probe clinical experience further'"
}
```

**Prompt instructions to include:**
- Base the suggestion on the interview content and the role criteria — not on resume alone (the screening result is context, not the primary input at this stage).
- Flag any criteria that were unclear from the resume but became clearer (in either direction) during the interview.
- If the transcript is too short, incoherent, or clearly not an interview (e.g. wrong file), return an error flag rather than a low-confidence suggestion — HR should be told the transcript couldn't be analysed.
- Do not factor in anything unrelated to job performance: personal background, protected characteristics, anything not tied to a stated criterion.

### Transcript Analysis card (UI)
Display this as a new card below the AI Screening Result card on the Applicant Review page. Visual language should match the screening result card but be visually distinct (different left-border colour or header label "Interview Analysis") so HR can clearly tell the two apart.

Card contents:
- **Overall suggestion** badge: "Recommend hire" (green) / "Do not recommend" (red) / "Further review needed" (amber)
- **Confidence** label: High / Medium / Low — shown as a small secondary badge next to the suggestion
- **Summary** paragraph
- **Strengths** — bullet list
- **Concerns** — bullet list
- **Criteria update** — same per-criterion breakdown as the screening result, but showing what changed post-interview (e.g. "Licensing: was Unclear from resume → Confirmed met in interview")
- **Suggested next step** — shown in a callout box at the bottom of the card

### Human final decision section
Below the transcript analysis card, replace the existing "Confirm: Advance / Confirm: Reject" buttons with a three-option final decision:

- "Proceed to hire" (green)
- "Hold / further review" (amber)  
- "Reject" (red)

Same override logging logic applies: if HR's choice differs from the AI's `overall_suggestion`, prompt for a reason.

Store this as a new record type:

### Data model additions

**`TranscriptUpload`**
```
id: uuid
applicant_id: uuid (FK)
file_url: string
file_name: string
uploaded_at: timestamp
uploaded_by: string
```

**`TranscriptAnalysis`**
```
id: uuid
applicant_id: uuid (FK)
transcript_upload_id: uuid (FK)
overall_suggestion: enum — 'hire' | 'reject' | 'further_review'
confidence: enum — 'high' | 'medium' | 'low'
summary: text
strengths: jsonb — string[]
concerns: jsonb — string[]
criteria_update: jsonb — array matching schema above
suggested_next_step: text
created_at: timestamp
error_flag: boolean — true if the transcript couldn't be analysed
error_reason: text — nullable
```

**`FinalDecision`**
```
id: uuid
applicant_id: uuid (FK)
transcript_analysis_id: uuid (FK) — nullable (in case no transcript was uploaded)
decision: enum — 'hire' | 'reject' | 'further_review'
is_override: boolean
override_reason: text — nullable
decided_by: string
created_at: timestamp
```

---

## Summary: what to build, in order

1. **Public apply form** — lowest complexity, highest immediate impact. Build the `/apply/[roleId]` route and add the "Copy link" button to the Role Detail page. Reuse existing applicant creation and screening trigger logic.

2. **Bulk ZIP import** — medium complexity. Most of the work is server-side: unzip, parse, extract contact info, batch-queue screening. The UI is just a modal with a drop zone and a results summary.

3. **CSV import** — lighter than ZIP because no parsing required (contact info is already in the CSV). Build after ZIP since they share the same modal entry point and batch processing infrastructure.

4. **Transcript upload + analysis** — most complex because it introduces a new stage in the applicant lifecycle and a new AI prompt with more context inputs. Build last. Make sure the `Applicant.status` enum extension (`interviewed`, `decided`) and the `FinalDecision` table don't conflict with anything already built before starting this one.