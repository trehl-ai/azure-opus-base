-- BEFORE INSERT trigger: default owner_user_id and created_by_user_id to auth.uid()
-- if not provided. Prevents the "deal disappears in own-only filter" bug (#35)
-- when a frontend or API call forgets to set owner_user_id.

CREATE OR REPLACE FUNCTION public.deals_default_owner_to_auth_uid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_user_id IS NULL THEN
    NEW.owner_user_id := auth.uid();
  END IF;
  IF NEW.created_by_user_id IS NULL THEN
    NEW.created_by_user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_default_owner ON public.deals;
CREATE TRIGGER deals_default_owner
  BEFORE INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.deals_default_owner_to_auth_uid();
