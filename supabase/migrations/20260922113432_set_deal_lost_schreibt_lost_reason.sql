CREATE OR REPLACE FUNCTION public.set_deal_lost(p_deal_id uuid, p_lost_stage_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
  -- 22.09.2026: p_reason wurde bisher verworfen (lost_reason blieb immer leer).
  UPDATE deals
  SET pipeline_stage_id = p_lost_stage_id,
      status = 'lost',
      lost_reason = COALESCE(p_reason, lost_reason),
      updated_at = now()
  WHERE id = p_deal_id;
$function$;