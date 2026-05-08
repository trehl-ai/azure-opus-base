-- set_deal_reopen(): reverses won/lost on a deal
--   * status -> 'open'
--   * won_at, lost_at, lost_reason -> NULL
--   * pipeline_stage_id -> p_target_stage_id, falling back to the first
--     non-won/non-lost stage of the deal's pipeline (by position).
-- SECURITY DEFINER so frontend (authenticated) can call it without needing
-- direct UPDATE privileges on deals. Mirrors set_deal_won / set_deal_lost.

CREATE OR REPLACE FUNCTION public.set_deal_reopen(
  p_deal_id uuid,
  p_target_stage_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_id uuid;
  v_first_stage_id uuid;
  v_final_stage_id uuid;
BEGIN
  SELECT pipeline_id INTO v_pipeline_id FROM deals WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found: %', p_deal_id;
  END IF;

  SELECT id INTO v_first_stage_id
  FROM pipeline_stages
  WHERE pipeline_id = v_pipeline_id
    AND is_won_stage = false
    AND is_lost_stage = false
  ORDER BY position
  LIMIT 1;

  v_final_stage_id := COALESCE(p_target_stage_id, v_first_stage_id);

  UPDATE deals SET
    status = 'open',
    won_at = NULL,
    lost_at = NULL,
    lost_reason = NULL,
    pipeline_stage_id = v_final_stage_id,
    updated_at = now()
  WHERE id = p_deal_id;

  RETURN json_build_object(
    'success', true,
    'deal_id', p_deal_id,
    'pipeline_stage_id', v_final_stage_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_deal_reopen(uuid, uuid) TO service_role, authenticated;
