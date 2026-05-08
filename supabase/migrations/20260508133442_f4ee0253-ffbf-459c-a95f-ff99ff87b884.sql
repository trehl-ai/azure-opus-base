-- task_statuses_add_slug_is_default: TS interface in useTaskStatuses.ts expects slug + is_default
ALTER TABLE public.task_statuses ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.task_statuses ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

UPDATE public.task_statuses SET slug = 'offen', is_default = true WHERE name = 'Offen';
UPDATE public.task_statuses SET slug = 'in-bearbeitung' WHERE name = 'In Bearbeitung';
UPDATE public.task_statuses SET slug = 'erledigt' WHERE name = 'Erledigt';
UPDATE public.task_statuses SET slug = 'blockiert' WHERE name = 'Blockiert';
