-- Seed decision-outcome email templates (hire offer + rejection). These are
-- loaded by the interview final-decision email popup so a recruiter can email
-- the applicant right after proceeding to hire or reject. Guarded by
-- `where not exists` on used_for so re-running the migration is idempotent.
insert into public.email_templates (name, used_for, subject, body, last_edited)
select t.name, t.used_for, t.subject, t.body, t.last_edited
from (values
  ('Offer — you''re hired', 'Hire offer',
   'Great news about your application for the {{role_title}} role at {{clinic_name}}',
   E'Hi {{applicant_name}},\n\nWe''re delighted to offer you the {{role_title}} position at {{clinic_name}}! After reviewing your application and interview, the team was confident you''ll be a great addition.\n\nWe''ll follow up shortly with the formal offer details, including start date, compensation, and onboarding steps. If you have any questions in the meantime, just reply to this email.\n\nCongratulations, and welcome aboard!\n\nWarm regards,\nThe {{clinic_name}} hiring team',
   '2026-07-31'::timestamptz),
  ('Application update — not moving forward', 'Rejection',
   'Update on your application for the {{role_title}} role at {{clinic_name}}',
   E'Hi {{applicant_name}},\n\nThank you for taking the time to apply and interview for the {{role_title}} position at {{clinic_name}}. After careful consideration, we''ve decided not to move forward with your application at this time.\n\nThis was a difficult decision — we were genuinely impressed by much of your background. We''d like to keep your details on file and encourage you to apply for future openings that match your experience.\n\nWe wish you all the best in your search.\n\nKind regards,\nThe {{clinic_name}} hiring team',
   '2026-07-31'::timestamptz)
) as t(name, used_for, subject, body, last_edited)
where not exists (
  select 1 from public.email_templates e where e.used_for = t.used_for
);
