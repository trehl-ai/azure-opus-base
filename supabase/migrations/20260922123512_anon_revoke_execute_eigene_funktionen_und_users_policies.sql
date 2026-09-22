-- 22.09.2026: anon hatte EXECUTE auf 74 eigene aufrufbare Funktionen (67 SECURITY DEFINER), darunter
-- set_deal_won/lost/reopen, promote_eis_lead, cal_booking_intake, wr_mail_event, log_outreach_activity.
-- Der anon-Key liegt im Frontend-Bundle. Messung (Claude Code, 22.09.): CRM-Frontend ruft alle 22 RPCs
-- hinter ProtectedRoute (User-JWT), Edge Functions und n8n nutzen service_role, RLS-Policies sind
-- TO authenticated; Edge-Logs 24 h: der publishable Key beruehrt genau einen Endpunkt, rpc/termin_click_intake
-- (Terminlink-Route /t/, serverseitig). Alle 74 haben einen expliziten authenticated-Grant (proacl 74/74).
-- Allowlist: termin_click_intake. Nicht angefasst: pgvector-Extension-Grants (118), Trigger-Funktionen (18).
-- Liste live aus pg_proc erzeugt (prokind f, prorettype <> trigger, kein Extension-Member, anon EXECUTE = true).
-- Erster Versuch brach im Verify ab: eis_contacts_insert hat KEINEN authenticated-Grant (service_role only, seit je) —
-- das ist Bestand, nicht Folge dieses REVOKE, und wird im Verify ausgenommen.

REVOKE EXECUTE ON FUNCTION public.anrede_team_oder_kollegium(p_firmenname text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cal_booking_intake(p_payload jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cal_ist_werteraum_event(p_event_id text, p_title text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cal_schule_aus_responses(p_responses jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.campaign_id_aus_utm(p_utm text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_all_tasks() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write_deals() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.compute_academy_intel_hash(p_contact_id uuid, p_concept_slug text, p_concept_version text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.contact_in_pipeline(p_contact_id uuid, p_pipeline_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.deal_roadshow_details(deal_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_contact_by_email(p_email text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_contact_by_email_vr(p_email text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_deal_by_email(p_email text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finish_enrichment(p_queue_id uuid, p_error text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_eis_recalculate_score(p_lead_id uuid, p_company_size_score integer, p_csr_signal_score integer, p_sponsor_affinity_score integer, p_decision_maker_score integer, p_regional_fit_score integer, p_score_reasoning text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_academy_intel_context(p_contact_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_academy_intel_context(p_contact_id uuid, p_concept_slug text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_academy_intel_status_bulk(p_contact_ids uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_academy_intel_status_bulk(p_contact_ids uuid[], p_concept_slug text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_activity_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_aktionsliste(p_limit integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_campaign_overview() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(p_pipeline_id uuid, p_won_year integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_domain_tagesbudget(p_domain text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_due_second_mailings(p_limit integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_eis_connect_queue(p_limit integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_enrichment_batch(p_limit integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_erneutes_mailing_context(p_deal_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_health_check_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_activities() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_outreach_activities(p_limit integer, p_pipeline_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_overdue_second_mailings() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_public_user_id(_auth_user_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_revenue_by_year(p_pipeline_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_scoring_queue(p_limit integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_scrape_queue(p_limit integer, p_bundesland text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_top_kunden_won(p_limit integer, p_pipeline_id uuid, p_won_year integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_top_leads(p_limit integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_top_sponsoring_leads(p_limit integer, p_concept_slug text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(_user_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_vr_stiftungen_candidates(p_limit integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_vr_stiftungen_companies() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_vr_stiftungen_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_website_scrape_queue(p_limit integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_werteraum_aktive_kampagnen() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_werteraum_bundesland_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_werteraum_candidates(p_limit integer, p_bundesland text, p_segment text, p_domain_cap integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_werteraum_hook_targets(p_limit integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_management_or_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_team_members() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_eis_activity(p_contact_id uuid, p_type text, p_title text, p_description text, p_metadata jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_outreach_activity(p_deal_id uuid, p_contact_id uuid, p_type text, p_title text, p_description text, p_metadata jsonb, p_campaign_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_schneeball_referral(p_source_contact_id uuid, p_target_school text, p_target_contact text, p_intro_sent boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_contacts(query_embedding vector, match_threshold double precision, match_count integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_eis_knowledge(query_embedding vector, match_threshold double precision, match_count integer, filter_type text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.norm_company_name(p_name text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pipelines_with_deals() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.promote_eis_contact(p_eis_id uuid, p_website text, p_owner uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.promote_eis_lead(p_lead_queue_id uuid, p_connected_on date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reset_stale_enrichment(p_minuten integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_deal_lost(p_deal_id uuid, p_lost_stage_id uuid, p_reason text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_deal_reopen(p_deal_id uuid, p_target_stage_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_deal_won(p_deal_id uuid, p_won_stage_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_deal_won_and_create_project(p_deal_id uuid, p_winning_user_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_werteraum_termin(p_email text, p_booking_uid text, p_starts_at timestamp with time zone, p_booker_name text, p_titel text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_academy_intel(p_contact_id uuid, p_concept_hash text, p_status text, p_intel jsonb, p_fit_score integer, p_entity_gate jsonb, p_error_message text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_academy_intel(p_contact_id uuid, p_concept_hash text, p_status text, p_intel jsonb, p_fit_score integer, p_entity_gate jsonb, p_error_message text, p_concept_slug text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_pipeline(p_pipeline_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wr_kernkey(p_name text, p_ort text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wr_mail_event(p_email text, p_typ text, p_subject text, p_body text, p_grund text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wr_normkey(p_name text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wr_tageswaechter() FROM PUBLIC, anon;

ALTER POLICY users_self_or_admin_update ON public.users TO authenticated;
ALTER POLICY users_self_insert ON public.users TO authenticated;

DO $chk$
DECLARE
  v_anon_noch int;
  v_auth_verloren int;
BEGIN
  SELECT count(*) INTO v_anon_noch
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
  WHERE ns.nspname='public' AND p.prokind='f' AND p.prorettype <> 'trigger'::regtype
    AND p.proname <> 'termin_click_intake'
    AND NOT EXISTS (SELECT 1 FROM pg_depend dp JOIN pg_extension e ON e.oid=dp.refobjid WHERE dp.objid=p.oid AND dp.deptype='e')
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_anon_noch <> 0 THEN RAISE EXCEPTION 'anon hat noch EXECUTE auf % eigene Funktionen', v_anon_noch; END IF;

  SELECT count(*) INTO v_auth_verloren
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
  WHERE ns.nspname='public' AND p.prokind='f' AND p.prorettype <> 'trigger'::regtype
    AND p.proname <> 'eis_contacts_insert'
    AND NOT EXISTS (SELECT 1 FROM pg_depend dp JOIN pg_extension e ON e.oid=dp.refobjid WHERE dp.objid=p.oid AND dp.deptype='e')
    AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF v_auth_verloren <> 0 THEN RAISE EXCEPTION 'authenticated hat EXECUTE auf % Funktionen verloren', v_auth_verloren; END IF;

  IF NOT has_function_privilege('anon', 'public.termin_click_intake(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'termin_click_intake fuer anon nicht mehr aufrufbar';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users'
             AND policyname IN ('users_self_or_admin_update','users_self_insert') AND roles::text[] && ARRAY['public','anon']) THEN
    RAISE EXCEPTION 'users-Policy gilt weiterhin fuer anon/public';
  END IF;
END
$chk$;