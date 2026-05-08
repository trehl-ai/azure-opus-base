-- import_jobs_rename_created_by: align column with Import.tsx (started_by_user_id)
ALTER TABLE public.import_jobs RENAME COLUMN created_by TO started_by_user_id;
