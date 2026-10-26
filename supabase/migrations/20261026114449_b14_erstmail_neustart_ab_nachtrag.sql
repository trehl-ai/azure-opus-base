-- B14 Variante D, Nachtrag: erstmail_neustart_ab = Zeitpunkt der Adresskorrektur laut audit_log
-- (identisch mit der Notiz "Mailadresse korrigiert"), Zwillinge mit dem Zeitpunkt ihres Partners.
-- 50aeddb6, 679cb793, a189c8fb bewusst NICHT: die neue Adresse wurde ueber andere Kontakte schon angeschrieben.
DO $nachtrag$
DECLARE n int; total int := 0;
BEGIN
  -- 724624ea Grundschule Germersheim Eduard-Orth (?) | korrigiert
  UPDATE public.deals SET erstmail_neustart_ab = '2026-09-10 13:46:10.194377+00'::timestamptz
   WHERE id = '724624ea-7581-413d-901a-5a16c7293f9b' AND erstmail_neustart_ab IS NULL AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Guard 724624ea-7581-413d-901a-5a16c7293f9b: % Zeilen', n; END IF; total := total + n;
  -- 5e209c78 Grundschule Diez Pestalozzi (?) | korrigiert
  UPDATE public.deals SET erstmail_neustart_ab = '2026-09-10 13:46:10.710607+00'::timestamptz
   WHERE id = '5e209c78-bea2-4fc7-adf1-7fc3354135ac' AND erstmail_neustart_ab IS NULL AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Guard 5e209c78-bea2-4fc7-adf1-7fc3354135ac: % Zeilen', n; END IF; total := total + n;
  -- 5a971d12 Grundschule Diez Pestalozzi | Zwilling von 5e209c78
  UPDATE public.deals SET erstmail_neustart_ab = '2026-09-10 13:46:10.710607+00'::timestamptz
   WHERE id = '5a971d12-87aa-4065-8f97-aa791713e2e2' AND erstmail_neustart_ab IS NULL AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Guard 5a971d12-87aa-4065-8f97-aa791713e2e2: % Zeilen', n; END IF; total := total + n;
  -- 959a2e21 Grundschule Neustädter (Celle) | korrigiert
  UPDATE public.deals SET erstmail_neustart_ab = '2026-09-10 13:31:04.696191+00'::timestamptz
   WHERE id = '959a2e21-99ca-475b-8444-fdfdbb2b7323' AND erstmail_neustart_ab IS NULL AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Guard 959a2e21-99ca-475b-8444-fdfdbb2b7323: % Zeilen', n; END IF; total := total + n;
  -- a75a9708 Grundschule Neustädter (Celle) | Zwilling von 959a2e21
  UPDATE public.deals SET erstmail_neustart_ab = '2026-09-10 13:31:04.696191+00'::timestamptz
   WHERE id = 'a75a9708-51cf-4e8b-9332-776f212ff3a3' AND erstmail_neustart_ab IS NULL AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Guard a75a9708-51cf-4e8b-9332-776f212ff3a3: % Zeilen', n; END IF; total := total + n;
  -- 613be5b6 Gemeinschaftsgrundschule Bernberg (Gummersbach) | korrigiert
  UPDATE public.deals SET erstmail_neustart_ab = '2026-09-10 13:11:20.597145+00'::timestamptz
   WHERE id = '613be5b6-70d6-43c6-be43-35d0a009a11f' AND erstmail_neustart_ab IS NULL AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Guard 613be5b6-70d6-43c6-be43-35d0a009a11f: % Zeilen', n; END IF; total := total + n;
  -- c1b92134 Gemeinschaftsgrundschule Bernberg | Zwilling von 613be5b6
  UPDATE public.deals SET erstmail_neustart_ab = '2026-09-10 13:11:20.597145+00'::timestamptz
   WHERE id = 'c1b92134-c306-463f-beaa-d9639e1e1119' AND erstmail_neustart_ab IS NULL AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Guard c1b92134-c306-463f-beaa-d9639e1e1119: % Zeilen', n; END IF; total := total + n;
  -- 3faf8a72 Gemeinschaftsgrundschule Martin-Luther (Brühl) | korrigiert
  UPDATE public.deals SET erstmail_neustart_ab = '2026-09-20 16:05:42.263914+00'::timestamptz
   WHERE id = '3faf8a72-461b-4fef-b090-609c97022e0a' AND erstmail_neustart_ab IS NULL AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Guard 3faf8a72-461b-4fef-b090-609c97022e0a: % Zeilen', n; END IF; total := total + n;
  -- 05369b70 Grundschule Kaiserslautern Kotten | korrigiert
  UPDATE public.deals SET erstmail_neustart_ab = '2026-09-10 18:15:04.201546+00'::timestamptz
   WHERE id = '05369b70-5563-4c4c-a4dd-0c8be5efe977' AND erstmail_neustart_ab IS NULL AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Guard 05369b70-5563-4c4c-a4dd-0c8be5efe977: % Zeilen', n; END IF; total := total + n;
  -- 753485a8 Grundschule Kaiserslautern Kotten | Zwilling von 05369b70
  UPDATE public.deals SET erstmail_neustart_ab = '2026-09-10 18:15:04.201546+00'::timestamptz
   WHERE id = '753485a8-c3d1-4ca7-bcd7-040154ab9c71' AND erstmail_neustart_ab IS NULL AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Guard 753485a8-c3d1-4ca7-bcd7-040154ab9c71: % Zeilen', n; END IF; total := total + n;
  -- b0619cdd Johann-Wolfgang-von-Goethe-Schule (Limburg an der Lahn) | korrigiert
  UPDATE public.deals SET erstmail_neustart_ab = '2026-09-10 13:41:05.169551+00'::timestamptz
   WHERE id = 'b0619cdd-be4e-459b-b579-baf480d1ceb5' AND erstmail_neustart_ab IS NULL AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Guard b0619cdd-be4e-459b-b579-baf480d1ceb5: % Zeilen', n; END IF; total := total + n;
  -- 85f632ec Johann-Wolfgang-von-Goethe-Schule | Zwilling von b0619cdd
  UPDATE public.deals SET erstmail_neustart_ab = '2026-09-10 13:41:05.169551+00'::timestamptz
   WHERE id = '85f632ec-2bf7-4258-ab88-a1297366c34c' AND erstmail_neustart_ab IS NULL AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'Guard 85f632ec-2bf7-4258-ab88-a1297366c34c: % Zeilen', n; END IF; total := total + n;
  IF total <> 12 THEN RAISE EXCEPTION 'Gesamt-Guard: % statt 12, Rollback', total; END IF;
END
$nachtrag$;
