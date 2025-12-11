-- Fix security warnings

-- 1. Revoke API access to materialized view (prevent direct access)
REVOKE ALL ON public.driver_rating_aggregates FROM anon, authenticated;

-- Grant only to service role (for edge functions)
GRANT SELECT ON public.driver_rating_aggregates TO service_role;