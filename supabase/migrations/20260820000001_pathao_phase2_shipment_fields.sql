-- Pathao Phase 2 shipment persistence fields.
-- Additive only; do not apply automatically to Production.
-- No credentials or tokens are stored here.

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS merchant_order_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_order_status TEXT,
  ADD COLUMN IF NOT EXISTS provider_status_slug TEXT,
  ADD COLUMN IF NOT EXISTS provider_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS amount_to_collect NUMERIC(12, 2);

CREATE UNIQUE INDEX IF NOT EXISTS shipments_provider_merchant_order_idx
  ON public.shipments(provider, merchant_order_id)
  WHERE merchant_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS shipments_provider_shipment_id_idx
  ON public.shipments(provider, provider_shipment_id)
  WHERE provider_shipment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS shipments_provider_status_idx
  ON public.shipments(provider, provider_order_status);
