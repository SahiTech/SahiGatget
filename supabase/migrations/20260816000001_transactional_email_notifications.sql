-- Transactional email delivery state is intentionally isolated from commerce state.
CREATE TABLE IF NOT EXISTS public.email_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  event_key TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('ORDER_CONFIRMATION', 'ADMIN_NEW_ORDER', 'ORDER_STATUS')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED')),
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS email_notifications_order_id_idx ON public.email_notifications(order_id);
CREATE INDEX IF NOT EXISTS email_notifications_provider_message_id_idx ON public.email_notifications(provider_message_id);
CREATE INDEX IF NOT EXISTS email_notifications_status_idx ON public.email_notifications(status);

ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.email_notifications TO service_role;

CREATE OR REPLACE FUNCTION public.touch_email_notifications_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_notifications_touch_updated_at ON public.email_notifications;
CREATE TRIGGER email_notifications_touch_updated_at
BEFORE UPDATE ON public.email_notifications
FOR EACH ROW EXECUTE FUNCTION public.touch_email_notifications_updated_at();

REVOKE ALL ON FUNCTION public.touch_email_notifications_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_email_notifications_updated_at() TO service_role;
