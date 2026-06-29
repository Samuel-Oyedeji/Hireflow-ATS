# HireFlow — Product Requirements Document

**For**: Claude Code implementation handoff
**Context**: UI was generated in Lovable (Vite + React) and needs migration to Next.js, then wired up to real data, AI screening logic, and email sending. This document describes what the application is, how it should behave, and what "done" looks like for v1 (demo scope).

---

## 1. What this application is

HireFlow is an **AI-assisted hiring management system** built for a healthcare/clinical organization (a multi-clinic physiotherapy network, expandable to similar orgs). It is an **internal tool** used by HR staff to manage the early stages of recruitment: intake, AI-powered resume screening, human review/override, and sending interview invites.

It is explicitly **not** a public job board or applicant-facing portal in v1 — applicants do not log in or interact with the system directly. HR staff manually upload each applicant's documents on their behalf. This is a deliberate scope decision for the demo; the architecture should not make it hard to add a public application form later.

### The core problem it solves
Resume screening and shortlisting currently take HR staff hours per role and are inconsistent across reviewers. HireFlow uses AI to pre-screen every applicant against role-specific criteria, surfaces a score + decision + plain-language reasoning for each one, and lets a human confirm or override that decision before anything becomes final. Once a shortlist is confirmed, templated interview invite emails go out automatically.

### Where the flow ends (for now)
The system's scope ends once interview invite emails are sent. The data model must leave room to extend into interview scheduling, interview notes, and offer stages later **without restructuring existing tables** — but none of that needs to be built now.

---

## 2. User roles (v1)

There is one user type in v1: **HR Staff / Reviewer**. They can:
- Create and edit roles (with screening criteria)
- Upload applicant documents
- View AI screening results
- Confirm or override AI decisions
- Manage email templates
- Trigger sending of interview invites

No authentication complexity is required beyond a simple login (single role/permission level). Multi-tenant org support, admin roles, and granular permissions are explicitly out of scope for v1.

---

## 3. Core entities & data model

Build these as the foundational schema. Field names are suggestions, not contracts — keep semantics, adjust naming to project conventions.

### `Role`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| title | string | e.g. "Massage Therapist" |
| department | string | |
| status | enum | `open`, `closed` |
| created_at | timestamp | |
| criteria | relation → `RoleCriterion[]` | one role has many criteria |

### `RoleCriterion`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| role_id | uuid (FK) | |
| label | string | e.g. "Minimum years of experience" |
| description | text | e.g. "Must hold valid RPT license in Ontario" |
| importance | enum | `required`, `preferred`, `nice_to_have` |

### `Applicant`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| name | string | |
| email | string | |
| phone | string | nullable |
| role_id | uuid (FK) | the role they applied for |
| status | enum | `uploaded`, `screened`, `reviewed`, `invited` — **design this field to be extensible**; treat it as an applicant lifecycle stage, not a fixed set baked into business logic, so later stages (`interview_scheduled`, `offer_sent`, etc.) can be appended without refactoring |
| created_at | timestamp | |

### `ApplicantDocument`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| applicant_id | uuid (FK) | |
| type | enum | `resume`, `cover_letter`, `other` |
| file_url | string | storage path/URL |
| file_name | string | original filename, for display |
| uploaded_at | timestamp | |

### `ScreeningResult`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| applicant_id | uuid (FK) | one-to-one with applicant (latest result), or one-to-many if re-screening is ever supported |
| score | integer | 0–100 |
| ai_decision | enum | `advance`, `reject` |
| reasoning | text | plain-language explanation, AI-generated |
| criteria_breakdown | jsonb | array of `{ criterion_id, met: boolean/null, note }` — null means "not assessable from documents" |
| created_at | timestamp | |

### `HumanDecision`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| applicant_id | uuid (FK) | |
| screening_result_id | uuid (FK) | the AI result this decision is responding to |
| decision | enum | `advance`, `reject` |
| is_override | boolean | true if `decision` != the AI's `ai_decision` |
| override_reason | text | nullable; collected when `is_override` is true |
| reviewed_by | string | reviewer identifier/name |
| created_at | timestamp | |

**Why a separate `HumanDecision` table instead of just a field on `Applicant`**: this preserves a full log of every override, which is explicitly needed to refine screening criteria over time (see Section 6). Never overwrite or discard this data.

### `EmailTemplate`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| name | string | |
| subject | string | supports placeholders |
| body | text | supports placeholders, simple rich text (bold/italic/link) |
| created_at | timestamp | |

Supported placeholders (v1): `{{applicant_name}}`, `{{role_title}}`, `{{clinic_name}}`, `{{interview_scheduling_link}}` (this last one is a placeholder for a future feature — render as empty string or omit gracefully if unused in v1).

### `SentEmail`
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| applicant_id | uuid (FK) | |
| template_id | uuid (FK) | |
| sent_at | timestamp | |
| status | enum | `sent`, `failed` |

---

## 4. End-to-end flow

1. **HR creates a Role** — sets title, department, and a list of screening criteria (each with a label, description, and importance level).
2. **HR uploads an Applicant** — manually enters name/contact info, selects the role, and uploads resume/CV (required), cover letter (optional), and any other document (optional). Each document is tracked against that specific applicant.
3. **AI Screening runs automatically on submission** — the system sends the applicant's documents + the role's criteria to an LLM, which returns: a score (0–100), a decision (`advance`/`reject`), a plain-language reasoning paragraph, and a per-criterion breakdown (met / not met / unclear). This is stored as a `ScreeningResult`. See Section 5 for prompt design.
4. **HR reviews the result** on the Applicant Review page — sees the AI's score, decision, reasoning, and criteria breakdown side-by-side with the original uploaded documents.
5. **HR confirms or overrides** — clicks "Confirm: Advance" or "Confirm: Reject." If this differs from the AI's `ai_decision`, the UI requires (or strongly prompts for) a short override reason. This is stored as a `HumanDecision`, linked back to the `ScreeningResult` it responds to.
6. **HR finalizes the shortlist for a role** — from the Role Detail page, once at least one applicant is confirmed as `advance`, HR can trigger "Finalize & Send Invites." This shows a confirmation modal listing every applicant who will receive an email, with the template to be used.
7. **System sends interview invite emails** — using the selected `EmailTemplate`, placeholders filled in per applicant, logged as a `SentEmail`. Applicant status updates to `invited`.

---

## 5. AI screening logic — implementation notes

This is the core "intelligence" of the product. Implementation approach:

- **Input to the AI call**: the role's criteria (label, description, importance) + extracted text from the applicant's resume/CV and cover letter. Documents should be parsed to plain text before being sent to the model (PDF/DOCX text extraction) rather than sending raw files, unless using a model with native document support.
- **Output should be structured** (use a JSON schema / structured output mode rather than parsing free text) containing:
  - `score` (integer 0–100)
  - `decision` (`advance` | `reject`)
  - `reasoning` (string, 2-4 sentences, written for a human reviewer, referencing specific criteria by name)
  - `criteria_breakdown` (array matching the role's criteria, each with `met: true | false | null` and a short `note`)
- **Decision threshold**: a role can be configured so "advance" generally correlates with meeting all `required` criteria — but the AI should still be allowed to use judgment (e.g. flagging a borderline case as `advance` with caveats noted in reasoning, for the human to weigh in on). Do not hard-code a rigid score cutoff as the sole decision driver; the score and the decision label are both AI outputs, not derived from each other by a fixed rule, since that mirrors how a human reviewer would actually weigh "a few points short on years of experience" differently than "fails to hold a required license."
- **No bias on protected characteristics**: criteria should be limited to job-relevant factors (experience, licensing, certifications, relevant skills). The system should not screen on or surface anything related to protected characteristics (age, gender, ethnicity, etc.) even if inferable from documents — the AI prompt should explicitly instruct the model to disregard these and screen only against the defined criteria.
- **Human-in-the-loop is mandatory, not optional**: the AI's decision is always provisional until a `HumanDecision` is recorded. No applicant should be auto-rejected or auto-advanced without a human confirming, in v1. This matters for both fairness and liability — frame this in any client-facing material, not just code comments.

---

## 6. Override logging & future criteria refinement

Every time a human's decision differs from the AI's (`HumanDecision.is_override = true`), this is captured with an optional reason. **Do not build automated retraining/fine-tuning in v1** — but do not discard this data either. The intent is that this log becomes the dataset a future iteration uses to:
- Identify roles/criteria where the AI's calls are frequently overridden (a signal that criteria need to be clarified or reweighted)
- Eventually inform prompt refinement or few-shot examples for that role

For v1, it's sufficient that this data is captured cleanly and queryable (e.g. a simple internal report: "X% of decisions overridden, by role" is a nice-to-have, not required for the demo).

---

## 7. Email sending

- Email sending in v1 can use any standard transactional email provider (e.g. Resend, since that's already used elsewhere in this developer's stack — but this is an implementation detail Claude Code should confirm rather than assume a specific provider is wired up).
- Sending should be triggered explicitly by the "Send Invites" confirmation action — never automatically as a side effect of an HR decision being saved.
- Template placeholder substitution should fail gracefully (e.g. missing applicant phone shouldn't break an email that doesn't even use that placeholder) and should not silently send broken/unsubstituted `{{placeholder}}` text if a value is missing — log/flag instead.

---

## 8. Migration notes (Lovable/Vite → Next.js)

The UI will arrive as a Vite + React app. Migration considerations:
- Convert routing from React Router (Lovable's default) to Next.js App Router conventions (`app/` directory, file-based routing)
- Move any client-side data fetching to appropriate Next.js patterns (Server Components for initial data load where sensible, Client Components for interactive forms/modals)
- Re-implement file upload handling using Next.js API routes or Server Actions rather than whatever mock/local handling Lovable scaffolds
- Environment variables and API keys (LLM provider, email provider, file storage) need proper Next.js env handling (`.env.local`, no secrets in client bundles)
- Replace any mock/placeholder data arrays from the Lovable build with real database queries once the schema (Section 3) is implemented
- Preserve the design system (colors, spacing, component structure) as-is — this PRD assumes the visual design from the Lovable build is final for v1; this document covers behavior and data, not visual redesign

---

## 9. Explicitly out of scope for v1

- Public-facing application form/portal (applicants don't self-submit)
- Interview scheduling, interview notes, or offer-stage workflow (data model should not block adding these later)
- Multi-user permissions/roles beyond a single HR staff login
- Automated retraining of screening criteria based on override data
- Multi-language support
- Dark mode

---

## 10. Open questions to confirm with the client before/while building

- Final choice of LLM provider for screening (affects structured output implementation details)
- Final choice of email provider and sender domain/identity
- Whether "Pending Review" applicants (AI hasn't run, or result is inconclusive) need a distinct handling path beyond what's described above
- Document storage approach (local/dev storage vs. a real object store like S3-compatible storage) for the demo vs. eventual production use
