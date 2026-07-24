ALTER TABLE public.pipeline_stages
  ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pipeline_stages.is_hidden IS
  'Blendet die Stage im Kanban-Board aus. Ersetzt die hartkodierte HIDDEN_STAGE_IDS-Liste im Frontend. Provisorium: die betroffenen Bundesland-Stages enthalten importierte Leads, die konzeptionell keine Deals sind.';

UPDATE public.pipeline_stages
   SET is_hidden = true, updated_at = now()
 WHERE id IN ('21c7ad65-0905-41cf-846a-9fc276545cc9',
              'd1f00bca-fcdd-4a55-a373-9c06e0544f05',
              '616dd027-993c-4875-bca7-0f5cc436a38b',
              '996ba733-5d04-44df-950a-f7e8af6245de');
