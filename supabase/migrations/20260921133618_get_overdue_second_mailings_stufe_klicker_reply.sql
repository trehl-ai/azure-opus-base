CREATE OR REPLACE FUNCTION public.get_overdue_second_mailings()
 RETURNS TABLE(scheduled_mailing_id uuid, deal_id uuid, contact_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- 21.09.2026: Die Auswahl pruefte bis heute weder Stufe noch Klicks noch Antworten.
  -- Am 21.09. gingen deshalb 5 Klicker mit "Grund: kein Interesse" auf Verloren; ohne diese
  -- Aenderung waeren bis 05.10. auch Deals in "Angebot erstellt", "Terminiert" und
  -- "Antwort erhalten" abgeschlossen worden (Simulation: 411 alt, 343 neu).
  -- POSITIVLISTE auf die Stufe: nur wer noch in "2. Mailing" steht, darf automatisch
  -- verloren gehen. Jede andere Stufe bedeutet: ein Mensch hat den Deal angefasst.
  SELECT sm.id, sm.deal_id, sm.contact_id
  FROM scheduled_mailings sm
  JOIN contacts c ON c.id = sm.contact_id
  JOIN deals d ON d.id = sm.deal_id
  WHERE sm.status = 'sent'
    AND sm.mailing_type = '2nd_mailing'
    AND sm.sent_at <= now() - interval '14 days'
    AND c.outreach_status NOT IN ('replied', 'terminated', 'link_clicked')
    AND d.deleted_at IS NULL
    AND d.status = 'open'
    AND d.pipeline_stage_id = '90c35866-ef9f-4dcf-be23-3e9ddecc1ae7'  -- "2. Mailing", Pipeline WerteRaum
    -- Regel 17.09.2026: Klicker werden angerufen, nicht abgeschlossen
    AND NOT EXISTS (
      SELECT 1 FROM deal_activities a
      WHERE a.deal_id = sm.deal_id AND a.deleted_at IS NULL
        AND a.activity_type IN ('link_click', 'termin_click'))
    -- eine verbuchte Antwort schuetzt auch dann, wenn outreach_status hinterherhinkt
    AND NOT EXISTS (
      SELECT 1 FROM deal_activities a
      WHERE a.deal_id = sm.deal_id AND a.deleted_at IS NULL
        AND a.activity_type = 'email_reply')
  ORDER BY sm.sent_at;
$function$;