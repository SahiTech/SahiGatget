-- Phase 7 hardening: invoice sequence and sensitive document permissions.
-- Applies only to the isolated SahiGatget Supabase project.

REVOKE ALL ON SEQUENCE public.invoice_number_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.invoice_number_seq TO service_role;

REVOKE ALL ON public.invoices, public.invoice_items FROM anon, authenticated;
GRANT SELECT ON public.invoices, public.invoice_items TO authenticated;

COMMENT ON TABLE public.invoices IS 'Immutable commercial invoice snapshots; application access is authorized server-side and sensitive fields are never exposed to anonymous clients.';
