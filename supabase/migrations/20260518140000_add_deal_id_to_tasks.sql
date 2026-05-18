-- Add optional deal_id link on tasks. Enables the unified To-Do view that
-- merges tasks (project-scoped) with deal_activities (deal-scoped) into a
-- single list. ON DELETE SET NULL so removing a deal doesn't cascade-kill tasks.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.tasks.deal_id IS 'Optional deal-Verknüpfung. Nullable. Tasks können entweder direkt mit einem Deal verbunden sein oder weiterhin nur über project_id mit einem Projekt/Kunden.';
CREATE INDEX IF NOT EXISTS tasks_deal_id_idx ON public.tasks(deal_id) WHERE deal_id IS NOT NULL;
