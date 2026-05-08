-- set_deal_won_also_jump_stage:
-- Existing RPC moved deals.status='won' but never moved pipeline_stage_id, so the
-- kanban card stayed in the old column visually after a drag-to-Won. Update RPC to
-- also set pipeline_stage_id to the pipeline's is_won_stage row (idempotent via
-- COALESCE — preserves a manually corrected stage and avoids overwriting won_at on
-- replay). Return shape stays json_build_object so existing callers keep working.

CREATE OR REPLACE FUNCTION public.set_deal_won_and_create_project(
  p_deal_id uuid,
  p_winning_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_deal deals%ROWTYPE;
  v_project_id uuid;
  v_won_stage_id uuid;
BEGIN
  SELECT ps.id INTO v_won_stage_id
  FROM pipeline_stages ps
  JOIN deals d ON d.pipeline_id = ps.pipeline_id
  WHERE d.id = p_deal_id AND ps.is_won_stage = true
  LIMIT 1;

  UPDATE deals
  SET status = 'won',
      won_at = COALESCE(won_at, NOW()),
      pipeline_stage_id = COALESCE(v_won_stage_id, pipeline_stage_id)
  WHERE id = p_deal_id
  RETURNING * INTO v_deal;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Deal not found');
  END IF;

  SELECT id INTO v_project_id FROM projects
  WHERE originating_deal_id = p_deal_id AND deleted_at IS NULL
  LIMIT 1;

  IF v_project_id IS NULL THEN
    INSERT INTO projects (title, originating_deal_id, owner_user_id, status, created_at)
    VALUES (v_deal.title, p_deal_id, p_winning_user_id, 'active', NOW())
    RETURNING id INTO v_project_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'deal_id', p_deal_id,
    'project_id', v_project_id,
    'pipeline_stage_id', v_deal.pipeline_stage_id
  );
END;
$function$;
