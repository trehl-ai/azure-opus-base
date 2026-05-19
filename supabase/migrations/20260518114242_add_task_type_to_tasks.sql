-- Add task_type column to tasks for the new chronological list view filter.
-- Free text (z.B. Anruf, Mail, Recherche). UI filter populates options from distinct values.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_type text;
COMMENT ON COLUMN public.tasks.task_type IS 'Aufgabenart, frei textuell (z.B. Anruf, Mail, Recherche). UI-Filter über distinct values.';
