-- 20260731061932_kampagnen_rpcs_anon_entzug
-- applied out-of-band via MCP, backfill.
-- Quelle: supabase_migrations.schema_migrations (ttgvhqygmgtnjgwunuwz), md5 b968bb6399e176b8571d61b9ab1967e2 verifiziert.
-- Schema-Reload-Anweisung entfernt: gehoert nicht in eine Migrationsdatei.
-- Postgres vergibt EXECUTE auf neue Funktionen per Default an PUBLIC. Bei
-- SECURITY-DEFINER-Funktionen heisst das: der anon-Key des Frontends koennte die
-- Geschaeftszahlen ohne Login abrufen. get_outreach_stats war korrekt gesperrt,
-- die drei neuen nicht. Gleiche Linie wie beim academy_intel-Entzug vom 30.07.
revoke execute on function public.get_kampagnen_uebersicht()        from public, anon;
revoke execute on function public.get_kampagne_unterkampagnen(text) from public, anon;
revoke execute on function public.get_kampagne_detail(text, text)   from public, anon;

grant execute on function public.get_kampagnen_uebersicht()         to authenticated;
grant execute on function public.get_kampagne_unterkampagnen(text)  to authenticated;
grant execute on function public.get_kampagne_detail(text, text)    to authenticated;
