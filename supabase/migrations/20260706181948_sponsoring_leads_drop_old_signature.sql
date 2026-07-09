-- Backfill of out-of-band migration 20260706181948 (sponsoring_leads_drop_old_signature).
-- The concept_filter revision above introduced a 2-arg signature
--   get_top_sponsoring_leads(integer, text)  (2nd arg has a DEFAULT),
-- which made the pre-existing 1-arg overload get_top_sponsoring_leads(integer) ambiguous
-- for calls like get_top_sponsoring_leads(20). This migration dropped that stale overload.
-- Reconstructed to reproduce the live end-state (only the 2-arg version now exists in ttgv).
-- Exact old body is no longer recoverable from the live DB; IF EXISTS makes this idempotent.

DROP FUNCTION IF EXISTS public.get_top_sponsoring_leads(integer);
