-- 20260731062333_trigger_auto_score_contact_auf_queue_umstellen
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 a8490a93210d115414dc4c0cb1e85f99 verifiziert.
-- Trigger auf die Warteschlange umstellen.
-- Vorher: net.http_post direkt im Trigger, nur fuer source IN ('gmail_intake','cloudtalk_import').
-- Zwei Probleme, beide behoben:
--  1. EINSCHLUSSliste. eis-bridge, telegram-intake, ssteo_import_v2, cal-inbound und manual
--     fehlten. Am 30.07. blieben dadurch 77 promovierte Kontakte ohne Embedding und waren im
--     Ideen-Matcher unsichtbar - ohne jede Fehlermeldung.
--  2. pg_net feuert pro Zeile. Eine Sammel-Promotion haette 77 gleichzeitige Gemini-Calls
--     ausgeloest; sequenziell lag die Fehlerquote bei 0,46 Prozent, parallel deutlich hoeher.
-- Jetzt: Der Trigger schreibt nur eine Queue-Zeile. Der Worker jybVHKHICejhox3u arbeitet sie
-- alle 10 Minuten sequenziell ab (20 je Lauf, rund 120 pro Stunde).
-- Die Ausschlussregel (Schulen, Kitas) sitzt bewusst in get_enrichment_batch, nicht hier -
-- eine Regelaenderung braucht dann keinen Trigger-Eingriff.
CREATE OR REPLACE FUNCTION public.trigger_auto_score_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.contact_enrichment_queue (contact_id, quelle, status)
  VALUES (NEW.id, NEW.source, 'pending')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ein Fehler beim Einreihen darf niemals den INSERT des Kontakts verhindern.
  RAISE WARNING 'contact_enrichment_queue: Einreihen fehlgeschlagen fuer %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.trigger_auto_score_contact() IS
'Reiht neue Kontakte in contact_enrichment_queue ein. Kein HTTP mehr im Trigger. Filterung erfolgt beim Abholen in get_enrichment_batch. Verarbeitung durch n8n-Workflow jybVHKHICejhox3u alle 10 Minuten.';
