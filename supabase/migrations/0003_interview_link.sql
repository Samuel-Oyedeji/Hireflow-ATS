-- Configurable interview scheduling link, surfaced in invite email templates as
-- {{interview_scheduling_link}} and editable from the Settings page.
alter table public.settings
  add column if not exists interview_link text not null default '';
