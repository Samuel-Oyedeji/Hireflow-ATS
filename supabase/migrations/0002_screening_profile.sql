-- 0002_screening_profile.sql — add extracted education / work history to screening
-- Run via the Supabase SQL editor, `supabase db push`, or:
--   psql "$DATABASE_URL" -f supabase/migrations/0002_screening_profile.sql
-- These are written alongside the other screening columns (ai_score, reasoning, …)
-- whenever an applicant is screened. Each holds a jsonb array of concise strings.

alter table public.applicants
  add column if not exists education    jsonb not null default '[]'::jsonb,  -- string[]
  add column if not exists work_history jsonb not null default '[]'::jsonb;  -- string[]
