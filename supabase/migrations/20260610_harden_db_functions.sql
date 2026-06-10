-- Migration: Harden database functions flagged by the Supabase security advisor
-- Date: 2026-06-10
--
-- Two issues addressed:
-- 1. Functions with a mutable search_path can be hijacked by objects created
--    in schemas earlier on the caller's path; pin them to public.
-- 2. SECURITY DEFINER functions were executable by anon (and authenticated)
--    via PostgREST /rpc. Execute is revoked where no client calls them:
--    trigger functions, cron-driven jobs, and the portal-data fetch (which
--    the get-portal-data edge function calls with the service role). The
--    authenticated role keeps generate_quote_number / generate_invoice_number
--    / route_performance_summary, which the app calls while signed in.

ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_invoice_number() SET search_path = public, pg_temp;
ALTER FUNCTION public.route_performance_summary() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_overdue_notifications() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_route_not_started_notifications() SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_old_notifications() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_quote_number() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_quotes_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.expire_sent_quotes() SET search_path = public, pg_temp;

-- Trigger / event-trigger functions: never called directly by clients.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_quotes_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_disable() FROM PUBLIC, anon, authenticated;

-- Cron-driven maintenance jobs: run by pg_cron as postgres, not by clients.
REVOKE EXECUTE ON FUNCTION public.generate_overdue_notifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_route_not_started_notifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_notifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_sent_quotes() FROM PUBLIC, anon, authenticated;

-- Portal data is served by the get-portal-data edge function using the
-- service role; clients should never call this directly.
REVOKE EXECUTE ON FUNCTION public.get_customer_portal_data(p_token uuid) FROM PUBLIC, anon, authenticated;

-- Called by the app while signed in: keep authenticated, drop anon.
REVOKE EXECUTE ON FUNCTION public.generate_invoice_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_quote_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.route_performance_summary() FROM PUBLIC, anon;
