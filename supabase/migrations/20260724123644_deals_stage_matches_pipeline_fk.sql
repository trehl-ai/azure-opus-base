ALTER TABLE public.pipeline_stages
  ADD CONSTRAINT pipeline_stages_pipeline_id_id_key UNIQUE (pipeline_id, id);

ALTER TABLE public.deals
  ADD CONSTRAINT deals_stage_matches_pipeline
  FOREIGN KEY (pipeline_id, pipeline_stage_id)
  REFERENCES public.pipeline_stages (pipeline_id, id);
