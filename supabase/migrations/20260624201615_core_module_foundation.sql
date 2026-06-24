CREATE SCHEMA IF NOT EXISTS core;
GRANT USAGE ON SCHEMA core TO authenticated, service_role;

-- ── Modul-Registry: installierte Module deklarativ ──────────────────────────
CREATE TABLE core.module_registry (
  module        text PRIMARY KEY,
  display_name  text NOT NULL,
  version       text NOT NULL DEFAULT '0.1.0',
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  installed_at  timestamptz NOT NULL DEFAULT now(),
  manifest      jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ── Capabilities: Rolle ⟶ Modul-Aktion (deklarativ, kein Core-Code-Change) ──
CREATE TABLE core.capabilities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module      text NOT NULL REFERENCES core.module_registry(module) ON DELETE CASCADE,
  capability  text NOT NULL,
  roles       text[] NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, capability)
);

-- ── Event-Spine: append-only Timeline (der HubSpot-Backbone) ────────────────
CREATE TABLE core.events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  module        text NOT NULL,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_core_events_entity ON core.events(entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_core_events_module ON core.events(module, event_type, occurred_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE core.module_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.capabilities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.events          ENABLE ROW LEVEL SECURITY;

-- Registry/Capabilities: alle authenticated lesen (Frontend prüft Verfügbarkeit), nur admin schreibt
CREATE POLICY mr_read   ON core.module_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY mr_admin  ON core.module_registry FOR ALL    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY cap_read  ON core.capabilities    FOR SELECT TO authenticated USING (true);
CREATE POLICY cap_admin ON core.capabilities    FOR ALL    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Events: Schreiben NUR via core.emit_event (SECURITY DEFINER) → kein direktes INSERT-Policy.
-- Lesen vorerst admin/management (per-Entity-Sichtbarkeit kommt mit der Timeline-UI). service_role via BYPASSRLS.
CREATE POLICY ev_read ON core.events FOR SELECT TO authenticated USING (public.can_manage_all_tasks());

GRANT SELECT ON core.module_registry, core.capabilities, core.events TO authenticated;

-- ── RPCs (öffentliche Modul-API; SECURITY DEFINER, gepinnter search_path) ───
CREATE FUNCTION core.emit_event(p_entity_type text, p_entity_id uuid, p_module text,
                                p_event_type text, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'core','public','auth' AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO core.events(entity_type, entity_id, module, event_type, payload, actor_user_id)
  VALUES (p_entity_type, p_entity_id, p_module, p_event_type, coalesce(p_payload,'{}'::jsonb), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE FUNCTION core.has_capability(p_module text, p_capability text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'core','public','auth' AS $$
  SELECT EXISTS (
    SELECT 1 FROM core.capabilities c
    WHERE c.module = p_module AND c.capability = p_capability
      AND public.get_user_role(auth.uid()) = ANY (c.roles)
  );
$$;

CREATE FUNCTION core.register_module(p_module text, p_display_name text,
                                     p_version text DEFAULT '0.1.0', p_manifest jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'core','public','auth' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'only admin may register modules'; END IF;
  INSERT INTO core.module_registry(module, display_name, version, manifest)
  VALUES (p_module, p_display_name, p_version, coalesce(p_manifest,'{}'::jsonb))
  ON CONFLICT (module) DO UPDATE
    SET display_name=EXCLUDED.display_name, version=EXCLUDED.version, manifest=EXCLUDED.manifest;
END $$;

GRANT EXECUTE ON FUNCTION core.emit_event(text,uuid,text,text,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.has_capability(text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.register_module(text,text,text,jsonb) TO authenticated;

-- Baseline: 'core' selbst registrieren
INSERT INTO core.module_registry(module, display_name, version, manifest)
VALUES ('core','Core CRM','1.0.0','{"owns":["contacts","companies","deals","pipelines","deal_activities","tasks","users"]}'::jsonb);