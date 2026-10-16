-- Checkout Recovery Engine: additive, forward-compatible fields on the existing session model.
ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS delivery_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recovery_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS recovery_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_consent_withdrawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_contact_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_last_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_outcome TEXT,
  ADD COLUMN IF NOT EXISTS recovery_outcome_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days');

CREATE INDEX IF NOT EXISTS checkout_sessions_recovery_idx
  ON public.checkout_sessions(status, last_activity_at ASC, expires_at);
CREATE INDEX IF NOT EXISTS checkout_sessions_recovery_consent_idx
  ON public.checkout_sessions(recovery_consent_at, recovery_consent_withdrawn_at, recovery_last_contacted_at);

CREATE TABLE IF NOT EXISTS public.checkout_recovery_history (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  checkout_session_id UUID NOT NULL REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
  actor_admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('CONSENT_GRANTED', 'CONSENT_WITHDRAWN', 'WHATSAPP_OPENED', 'CONTACTED', 'RECOVERED', 'NOT_INTERESTED', 'CLOSED')),
  notes TEXT,
  linked_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS checkout_recovery_history_session_idx
  ON public.checkout_recovery_history(checkout_session_id, created_at DESC);

ALTER TABLE public.checkout_recovery_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access checkout recovery history" ON public.checkout_recovery_history;
CREATE POLICY "Admin full access checkout recovery history"
  ON public.checkout_recovery_history FOR ALL
  USING (private.is_admin()) WITH CHECK (private.is_admin());
REVOKE ALL ON TABLE public.checkout_recovery_history FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.checkout_recovery_history TO service_role;
