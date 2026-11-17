DO $$
DECLARE d text;
  alt_snip text := 'AND NOT firma_ist_kunde(d.company_id, d.id)   -- 09.11.2026 Kundensperre';
  neu_snip text := E'AND NOT firma_ist_kunde(d.company_id, d.id)   -- 09.11.2026 Kundensperre\n      AND d.segment IS DISTINCT FROM ''beruflich''   -- 17.11.2026: Berufsschulen (16–20 J.) passen nicht zu Fit & Aktiv Kl. 5–7, Entscheidung Tomi';
BEGIN
  d := pg_get_functiondef('public.get_fua_nachfass_candidates'::regproc);
  IF (length(d) - length(replace(d, alt_snip, ''))) / length(alt_snip) <> 1 THEN RAISE EXCEPTION 'Snippet nicht genau 1x'; END IF;
  EXECUTE replace(d, alt_snip, neu_snip);
END $$;