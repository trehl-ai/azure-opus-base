-- import_jobs_rename_fk_constraint_and_retarget:
-- Postgres RENAME COLUMN keeps the auto-generated FK name; rename it so PostgREST resolves
-- Import.tsx's `users!import_jobs_started_by_user_id_fkey` embed.
-- Also retarget FK from auth.users to public.users so the embed (which selects first_name/last_name)
-- actually finds the relation — auth schema isn't in PostgREST's exposed-schemas list.
ALTER TABLE public.import_jobs
  RENAME CONSTRAINT import_jobs_created_by_fkey TO import_jobs_started_by_user_id_fkey;

ALTER TABLE public.import_jobs
  DROP CONSTRAINT import_jobs_started_by_user_id_fkey;

ALTER TABLE public.import_jobs
  ADD CONSTRAINT import_jobs_started_by_user_id_fkey
  FOREIGN KEY (started_by_user_id) REFERENCES public.users(id);
