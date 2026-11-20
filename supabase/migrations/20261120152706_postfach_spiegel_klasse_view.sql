-- Zielbild 1.1 (20.11.2026): Mailart je Spiegel-Zeile deterministisch aus Kopfzeilen und Absender.
-- Nur lesende Sicht; der Intake und die Spalte postfach_spiegel.klasse bleiben unberuehrt.
CREATE VIEW public.v_postfach_spiegel_klasse
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.postfach,
  s.message_id,
  s.eingang_at,
  s.absender,
  s.absender_name,
  s.betreff,
  s.in_reply_to,
  CASE
    WHEN s.kopfzeilen->>'content-type' ILIKE '%multipart/report%'
      OR s.kopfzeilen->>'return-path' ~ '<>\s*$'
      OR s.absender ~* '^(mailer-daemon|postmaster)@' THEN 'dsn'
    WHEN s.absender ~* 'dmarc'
      OR s.betreff ~* 'Report domain:' THEN 'bericht'
    WHEN s.kopfzeilen->>'auto-submitted' ~* 'auto-(generated|replied|notified)'
      OR s.kopfzeilen ? 'x-autoreply'
      OR s.kopfzeilen ? 'x-autorespond'
      OR s.absender ~* '^(noreply|no-reply|autoresponder|donotreply)@' THEN 'automatisch'
    ELSE 'antwort'
  END AS klasse_regel,
  s.klasse AS klasse_spalte,
  left(s.text_body, 500) AS text_anfang,
  s.created_at
FROM public.postfach_spiegel s;

COMMENT ON VIEW public.v_postfach_spiegel_klasse IS
  'Mailart je Spiegel-Zeile nach festen Regeln: dsn | bericht | automatisch | antwort. Interesse/Absage wird innerhalb von antwort durch die Analyse bestimmt.';

REVOKE ALL ON public.v_postfach_spiegel_klasse FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_postfach_spiegel_klasse TO service_role;