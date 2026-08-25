-- Harden the email notification timestamp trigger against search_path manipulation.
-- Behavior is unchanged: every update refreshes updated_at to the current timestamp.
CREATE OR REPLACE FUNCTION public.touch_email_notifications_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_email_notifications_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_email_notifications_updated_at() TO service_role;
