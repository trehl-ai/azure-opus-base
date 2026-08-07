CREATE OR REPLACE FUNCTION public.sync_deal_status_from_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_won  boolean;
  v_lost boolean;
BEGIN
  IF NEW.pipeline_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(ps.is_won_stage, false), COALESCE(ps.is_lost_stage, false)
    INTO v_won, v_lost
  FROM public.pipeline_stages ps
  WHERE ps.id = NEW.pipeline_stage_id;

  IF v_won THEN
    NEW.status  := 'won';
    NEW.won_at  := COALESCE(NEW.won_at, now());
    NEW.lost_at := NULL;
  ELSIF v_lost THEN
    NEW.status  := 'lost';
    NEW.lost_at := COALESCE(NEW.lost_at, now());
    NEW.won_at  := NULL;
  ELSE
    IF NEW.status IN ('won','lost') THEN
      NEW.status := 'open';
    END IF;
    NEW.won_at  := NULL;
    NEW.lost_at := NULL;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_sync_deal_status ON public.deals;

CREATE TRIGGER trg_sync_deal_status
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_deal_status_from_stage();
