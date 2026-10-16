-- Portable analytics event contract + durable provider delivery ledger.
-- Existing commerce/order behavior is untouched.

ALTER TABLE public.commerce_events
  DROP CONSTRAINT IF EXISTS commerce_events_event_name_check;

ALTER TABLE public.commerce_events
  ADD CONSTRAINT commerce_events_event_name_check CHECK (
    event_name = ANY (ARRAY[
      'CART_CREATED','CART_ITEM_ADDED','CART_ITEM_UPDATED','CART_ITEM_REMOVED','CHECKOUT_STARTED','CHECKOUT_QUOTED','CHECKOUT_ABANDONED','ORDER_COMPLETED','PAYMENT_INITIATED','PAYMENT_VERIFIED','PAYMENT_FAILED','RISK_ASSESSED','SHIPMENT_CREATED','SHIPMENT_TRACKED','RETURN_REQUESTED',
      'page_view','view_item','view_item_list','search','select_item','add_to_cart','remove_from_cart','view_cart','begin_checkout','add_shipping_info','add_payment_info','purchase','refund','checkout_error','login','sign_up','generate_lead','contact','support_request','whatsapp_click','cart_created','cart_updated','cart_abandoned','cart_recovered','order_created','order_confirmed','order_cancelled','order_status_changed','checkout_started','checkout_progress','checkout_abandoned','checkout_recovered'
    ]::text[])
  );

CREATE TABLE IF NOT EXISTS public.analytics_delivery_ledger (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id text NOT NULL REFERENCES public.commerce_events(event_id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  event_payload jsonb NOT NULL,
  last_attempt_at timestamp with time zone,
  next_attempt_at timestamp with time zone,
  latency_ms integer,
  http_status integer,
  category text,
  response_excerpt text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT analytics_delivery_ledger_provider_check CHECK (provider = ANY (ARRAY['GA4','META_CAPI','TIKTOK_EVENTS_API','SERVER_GTM']::text[])),
  CONSTRAINT analytics_delivery_ledger_status_check CHECK (status = ANY (ARRAY['PENDING','SUCCEEDED','FAILED']::text[])),
  CONSTRAINT analytics_delivery_ledger_event_provider_key UNIQUE (event_id, provider)
);

CREATE INDEX IF NOT EXISTS analytics_delivery_ledger_retry_idx
  ON public.analytics_delivery_ledger (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS analytics_delivery_ledger_event_idx
  ON public.analytics_delivery_ledger (event_id);

ALTER TABLE public.analytics_delivery_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.analytics_delivery_ledger FROM anon, authenticated;
