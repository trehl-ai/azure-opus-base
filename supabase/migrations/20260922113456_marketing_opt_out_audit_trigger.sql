-- 22.09.2026: Audit fuer die Sperrliste. Der Standard-Trigger audit_log_trigger() liest NEW.id (uuid);
-- marketing_opt_out hat kein id, der PK ist email_normalized (text). Er wuerde in EXCEPTION laufen und
-- still nichts schreiben. Deshalb eigene Funktion: entity_id = md5(email_normalized)::uuid, deterministisch,
-- damit die Geschichte einer Adresse (Sperre gesetzt / entfernt) im audit_log zusammenhaengt.
CREATE OR REPLACE FUNCTION public.audit_log_marketing_opt_out()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_email text;
  v_details jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_email := OLD.email_normalized;
    v_details := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'INSERT' THEN
    v_email := NEW.email_normalized;
    v_details := jsonb_build_object('new', to_jsonb(NEW));
  ELSE
    v_email := NEW.email_normalized;
    v_details := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  END IF;

  INSERT INTO audit_log (id, entity_type, entity_id, aktion, details, user_id, created_at)
  VALUES (gen_random_uuid(), 'marketing_opt_out', md5(lower(v_email))::uuid, TG_OP, v_details, auth.uid(), now());

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;  -- Audit darf die Sperre nie blockieren (gleiches Prinzip wie audit_log_trigger)
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.audit_log_marketing_opt_out() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS audit_marketing_opt_out ON public.marketing_opt_out;
CREATE TRIGGER audit_marketing_opt_out
  AFTER INSERT OR UPDATE OR DELETE ON public.marketing_opt_out
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_marketing_opt_out();