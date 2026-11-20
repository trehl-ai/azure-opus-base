-- Standardrechte des Schemas gaben service_role alle Rechte auf die neue Sicht; gebraucht wird nur Lesen.
REVOKE ALL ON public.v_postfach_spiegel_klasse FROM service_role;
GRANT SELECT ON public.v_postfach_spiegel_klasse TO service_role;