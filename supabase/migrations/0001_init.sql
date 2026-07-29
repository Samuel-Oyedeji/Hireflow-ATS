-- 0001_init.sql — HireFlow schema
-- Run via the Supabase SQL editor, `supabase db push`, or:
--   psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
-- gen_random_uuid() is available on Supabase by default (pgcrypto).

-- ---------- settings (single row) ----------
create table public.settings (
  id                boolean primary key default true,
  current_user_name text not null default 'Jordan Avery',
  clinic_name       text not null default 'Riverside Clinic Group',
  constraint settings_singleton check (id)
);

-- ---------- roles + criteria ----------
create table public.roles (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  department   text not null,
  status       text not null default 'open' check (status in ('open','closed')),
  created_date timestamptz not null default now()
);

create table public.criteria (
  id         uuid primary key default gen_random_uuid(),
  role_id    uuid not null references public.roles(id) on delete cascade,
  label      text not null,
  detail     text not null,
  weight     text not null check (weight in ('required','preferred','nice-to-have')),
  sort_order int  not null default 0
);
create index criteria_role_id_idx on public.criteria(role_id);

-- ---------- bulk imports (before applicants: FK target) ----------
create table public.bulk_imports (
  id          uuid primary key default gen_random_uuid(),
  role_id     uuid not null references public.roles(id) on delete cascade,
  imported_by text not null,
  file_name   text not null,
  total_files int  not null default 0,
  successful  int  not null default 0,
  failed      int  not null default 0,
  skipped     int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- applicants (screening inline) ----------
create table public.applicants (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text not null,
  phone          text,
  role_id        uuid not null references public.roles(id) on delete cascade,
  source         text not null default 'manual_upload'
                   check (source in ('manual_upload','public_form','bulk_import')),
  notes          text,
  bulk_import_id uuid references public.bulk_imports(id) on delete set null,
  submitted_date timestamptz not null default now(),
  ai_score       int  not null default 0 check (ai_score between 0 and 100),
  ai_decision    text not null default 'rejected' check (ai_decision in ('advanced','rejected')),
  reasoning      text not null default '',
  human_decision text check (human_decision in ('advance','reject')),  -- null = pending
  override_reason text,
  decided_by     text,
  decided_date   timestamptz,
  invited        boolean not null default false,
  invited_date   timestamptz
);
create index applicants_role_id_idx        on public.applicants(role_id);
create index applicants_bulk_import_id_idx on public.applicants(bulk_import_id);

-- ---------- applicant documents ----------
create table public.applicant_documents (
  id             uuid primary key default gen_random_uuid(),
  applicant_id   uuid not null references public.applicants(id) on delete cascade,
  name           text not null,
  type           text not null check (type in ('resume','cover-letter','other')),
  file_name      text not null,
  storage_path   text,          -- path in the 'applicant-files' bucket (null if not stored)
  extracted_text text,          -- text fed to the LLM
  created_at     timestamptz not null default now()
);
create index applicant_documents_applicant_id_idx on public.applicant_documents(applicant_id);

-- ---------- per-criterion screening results ----------
create table public.criteria_results (
  id           uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  criterion_id uuid not null references public.criteria(id) on delete cascade,
  match        text not null check (match in ('met','not-met','partial')),
  note         text not null default ''
);
create index criteria_results_applicant_id_idx on public.criteria_results(applicant_id);

-- ---------- transcripts + analysis + final decision ----------
create table public.transcript_uploads (
  id             uuid primary key default gen_random_uuid(),
  applicant_id   uuid not null references public.applicants(id) on delete cascade,
  file_name      text not null,
  storage_path   text,
  extracted_text text,
  uploaded_at    timestamptz not null default now(),
  uploaded_by    text not null
);
create index transcript_uploads_applicant_id_idx on public.transcript_uploads(applicant_id);

create table public.transcript_analyses (
  id                   uuid primary key default gen_random_uuid(),
  applicant_id         uuid not null references public.applicants(id) on delete cascade,
  transcript_upload_id uuid not null references public.transcript_uploads(id) on delete cascade,
  overall_suggestion   text not null check (overall_suggestion in ('hire','reject','further_review')),
  confidence           text not null check (confidence in ('high','medium','low')),
  summary              text not null default '',
  strengths            jsonb not null default '[]'::jsonb,   -- string[]
  concerns             jsonb not null default '[]'::jsonb,   -- string[]
  criteria_update      jsonb not null default '[]'::jsonb,   -- {criterionId,originalAssessment,updatedAssessment,note}[]
  suggested_next_step  text not null default '',
  created_at           timestamptz not null default now(),
  error_flag           boolean not null default false,
  error_reason         text
);
create index transcript_analyses_applicant_id_idx on public.transcript_analyses(applicant_id);

create table public.final_decisions (
  id                     uuid primary key default gen_random_uuid(),
  applicant_id           uuid not null references public.applicants(id) on delete cascade,
  transcript_analysis_id uuid references public.transcript_analyses(id) on delete set null,
  decision               text not null check (decision in ('hire','reject','further_review')),
  is_override            boolean not null default false,
  override_reason        text,
  decided_by             text not null,
  created_at             timestamptz not null default now()
);
create index final_decisions_applicant_id_idx on public.final_decisions(applicant_id);

-- ---------- email templates ----------
create table public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  used_for    text not null default '',
  subject     text not null default '',
  body        text not null default '',
  last_edited timestamptz not null default now()
);

-- ---------- storage bucket for original files (private) ----------
insert into storage.buckets (id, name, public)
values ('applicant-files', 'applicant-files', false)
on conflict (id) do nothing;

-- ---------- RLS: on, no policies (service role only) ----------
alter table public.settings            enable row level security;
alter table public.roles               enable row level security;
alter table public.criteria            enable row level security;
alter table public.bulk_imports        enable row level security;
alter table public.applicants          enable row level security;
alter table public.applicant_documents enable row level security;
alter table public.criteria_results    enable row level security;
alter table public.transcript_uploads  enable row level security;
alter table public.transcript_analyses enable row level security;
alter table public.final_decisions     enable row level security;
alter table public.email_templates     enable row level security;

-- =========================================================
-- SEED: settings + 4 roles/criteria + 2 templates (no applicants)
-- =========================================================
insert into public.settings (id) values (true) on conflict (id) do nothing;

insert into public.roles (title, department, status, created_date) values
  ('Registered physiotherapist',          'Physiotherapy',        'open',   '2026-05-20'),
  ('Registered massage therapist (RMT)',  'Massage therapy',      'open',   '2026-06-02'),
  ('Clinic front desk coordinator',       'Administration',       'open',   '2026-06-15'),
  ('Occupational therapist',              'Occupational therapy', 'closed', '2026-04-10');

insert into public.criteria (role_id, label, detail, weight, sort_order)
select r.id, c.label, c.detail, c.weight, c.ord
from public.roles r
join (values
  ('Registered physiotherapist','Registration in good standing','Must hold a valid Physiotherapist registration with the College of Physiotherapists of Ontario.','required',0),
  ('Registered physiotherapist','Minimum years of experience','At least 3 years of clinical experience in an outpatient setting.','required',1),
  ('Registered physiotherapist','Pediatric experience','Experience treating pediatric patients.','preferred',2),
  ('Registered physiotherapist','Manual therapy certification','Completed manual therapy or dry needling certification.','nice-to-have',3),
  ('Registered massage therapist (RMT)','RMT registration','Valid RMT registration with the CMTO.','required',0),
  ('Registered massage therapist (RMT)','Evening & weekend availability','Available for evening and weekend shifts.','preferred',1),
  ('Registered massage therapist (RMT)','Deep tissue & sports massage','Trained in deep tissue and sports massage techniques.','preferred',2),
  ('Clinic front desk coordinator','Scheduling / EMR software','Experience with clinic scheduling or EMR software (e.g. Jane, Telus).','required',0),
  ('Clinic front desk coordinator','Customer service experience','2+ years in a patient-facing or customer service role.','required',1),
  ('Clinic front desk coordinator','Bilingual (EN/FR)','Conversational French is an asset.','nice-to-have',2),
  ('Occupational therapist','OT registration','Registered with the College of Occupational Therapists of Ontario.','required',0),
  ('Occupational therapist','Home assessment experience','Experience conducting home safety assessments.','preferred',1)
) as c(role_title, label, detail, weight, ord) on c.role_title = r.title;

insert into public.email_templates (name, used_for, subject, body, last_edited) values
  ('Interview invite — physiotherapist','Interview invite',
   'Interview invitation for the {{role_title}} role at {{clinic_name}}',
   E'Hi {{applicant_name}},\n\nThank you for applying for the {{role_title}} position at {{clinic_name}}. We were impressed by your application and would like to invite you to an interview.\n\nPlease use the link below to choose a time that works for you:\n{{interview_scheduling_link}}\n\nWe look forward to speaking with you.\n\nWarm regards,\nThe {{clinic_name}} hiring team',
   '2026-06-12'),
  ('General interview invite','Interview invite',
   'You''re invited to interview at {{clinic_name}}',
   E'Hi {{applicant_name}},\n\nWe''ve reviewed your application for the {{role_title}} role and would love to learn more about you. Please book an interview slot here:\n{{interview_scheduling_link}}\n\nThank you,\n{{clinic_name}}',
   '2026-06-05');
