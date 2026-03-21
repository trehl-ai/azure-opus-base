
-- Function to create a project from a won deal
CREATE OR REPLACE FUNCTION public.create_project_from_deal(p_deal_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal RECORD;
  v_project_id uuid;
BEGIN
  -- Read deal
  SELECT id, title, company_id, primary_contact_id, value_amount, currency,
         owner_user_id, description, priority
  INTO v_deal
  FROM public.deals
  WHERE id = p_deal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found: %', p_deal_id;
  END IF;

  -- Check for existing project (duplicate protection)
  SELECT id INTO v_project_id
  FROM public.projects
  WHERE originating_deal_id = p_deal_id;

  IF FOUND THEN
    RETURN v_project_id;
  END IF;

  -- Create project
  INSERT INTO public.projects (
    title, company_id, primary_contact_id, originating_deal_id,
    status, priority, owner_user_id, description, created_by_user_id
  ) VALUES (
    'Projekt: ' || v_deal.title,
    v_deal.company_id,
    v_deal.primary_contact_id,
    v_deal.id,
    'new',
    COALESCE(v_deal.priority, 'medium'),
    v_deal.owner_user_id,
    'Automatisch erstellt aus Deal: ' || v_deal.title || '. Deal-Wert: ' || COALESCE(v_deal.value_amount::text, '0') || ' ' || COALESCE(v_deal.currency, 'EUR'),
    v_deal.owner_user_id
  )
  RETURNING id INTO v_project_id;

  RETURN v_project_id;
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.trigger_create_project_on_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'won' AND (OLD.status IS DISTINCT FROM 'won') THEN
    PERFORM public.create_project_from_deal(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger
CREATE TRIGGER on_deal_won_create_project
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_project_on_won();
