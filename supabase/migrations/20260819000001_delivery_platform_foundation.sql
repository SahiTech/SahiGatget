-- Common provider-agnostic delivery foundation.
-- This migration is intentionally not applied automatically and contains no courier credentials.

CREATE TABLE IF NOT EXISTS public.delivery_providers (
  provider TEXT PRIMARY KEY CHECK (provider IN ('PATHAO', 'STEADFAST', 'REDX', 'CARRYBEE', 'ECOURIER')),
  display_name TEXT NOT NULL,
  connection_state TEXT NOT NULL DEFAULT 'NOT_CONNECTED' CHECK (connection_state IN ('NOT_CONNECTED', 'CONNECTED', 'DEGRADED', 'DISABLED')),
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.delivery_providers (provider, display_name)
VALUES
  ('PATHAO', 'Pathao'),
  ('STEADFAST', 'Steadfast'),
  ('REDX', 'REDX'),
  ('CARRYBEE', 'CarryBee'),
  ('ECOURIER', 'eCourier')
ON CONFLICT (provider) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL REFERENCES public.delivery_providers(provider),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'READY', 'CREATED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'RETURNED', 'EXCEPTION')),
  provider_shipment_id TEXT,
  tracking_number TEXT,
  label_reference TEXT,
  idempotency_key TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'NOT_ASSESSED' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'NOT_ASSESSED')),
  recipient_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  parcel_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS shipments_order_provider_idempotency_idx ON public.shipments(order_id, provider, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS shipments_provider_tracking_idx ON public.shipments(provider, tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS shipments_order_id_idx ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS shipments_status_idx ON public.shipments(status);
CREATE INDEX IF NOT EXISTS shipments_provider_idx ON public.shipments(provider);

CREATE TABLE IF NOT EXISTS public.shipment_history (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  provider TEXT REFERENCES public.delivery_providers(provider),
  previous_status TEXT CHECK (previous_status IS NULL OR previous_status IN ('DRAFT', 'READY', 'CREATED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'RETURNED', 'EXCEPTION')),
  new_status TEXT NOT NULL CHECK (new_status IN ('DRAFT', 'READY', 'CREATED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'RETURNED', 'EXCEPTION')),
  source TEXT NOT NULL CHECK (source IN ('ADMIN', 'PROVIDER_API', 'WEBHOOK', 'SYSTEM')),
  provider_event_id TEXT,
  CONSTRAINT shipment_history_provider_event_scope CHECK (provider_event_id IS NULL OR provider IS NOT NULL),
  notes TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shipment_history_shipment_idx ON public.shipment_history(shipment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shipment_history_provider_idx ON public.shipment_history(provider, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS shipment_history_provider_event_idx ON public.shipment_history(provider, provider_event_id) WHERE provider_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.delivery_webhook_events (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  provider TEXT NOT NULL REFERENCES public.delivery_providers(provider),
  provider_event_id TEXT NOT NULL,
  provider_shipment_id TEXT,
  event_type TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS delivery_webhook_events_provider_shipment_idx ON public.delivery_webhook_events(provider, provider_shipment_id);

CREATE TABLE IF NOT EXISTS public.delivery_audit_logs (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor_user_id UUID,
  provider TEXT REFERENCES public.delivery_providers(provider),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS delivery_audit_logs_shipment_idx ON public.delivery_audit_logs(shipment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_audit_logs_order_idx ON public.delivery_audit_logs(order_id, created_at DESC);

ALTER TABLE public.delivery_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access delivery_providers" ON public.delivery_providers;
CREATE POLICY "Admin full access delivery_providers" ON public.delivery_providers FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "Admin full access shipments" ON public.shipments;
CREATE POLICY "Admin full access shipments" ON public.shipments FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "Admin full access shipment_history" ON public.shipment_history;
CREATE POLICY "Admin full access shipment_history" ON public.shipment_history FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "Admin full access delivery_webhook_events" ON public.delivery_webhook_events;
CREATE POLICY "Admin full access delivery_webhook_events" ON public.delivery_webhook_events FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "Admin full access delivery_audit_logs" ON public.delivery_audit_logs;
CREATE POLICY "Admin full access delivery_audit_logs" ON public.delivery_audit_logs FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

REVOKE ALL ON TABLE public.delivery_providers, public.shipments, public.shipment_history, public.delivery_webhook_events, public.delivery_audit_logs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_providers, public.shipments, public.shipment_history, public.delivery_webhook_events, public.delivery_audit_logs TO service_role;
