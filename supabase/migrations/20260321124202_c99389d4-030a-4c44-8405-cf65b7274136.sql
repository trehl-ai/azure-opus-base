-- Fix security definer views - recreate as security invoker
DROP VIEW IF EXISTS active_companies;
DROP VIEW IF EXISTS active_contacts;
DROP VIEW IF EXISTS active_deals;
DROP VIEW IF EXISTS active_projects;

CREATE VIEW active_companies WITH (security_invoker = true) AS SELECT * FROM companies WHERE deleted_at IS NULL;
CREATE VIEW active_contacts WITH (security_invoker = true) AS SELECT * FROM contacts WHERE deleted_at IS NULL;
CREATE VIEW active_deals WITH (security_invoker = true) AS SELECT * FROM deals WHERE deleted_at IS NULL;
CREATE VIEW active_projects WITH (security_invoker = true) AS SELECT * FROM projects WHERE deleted_at IS NULL;