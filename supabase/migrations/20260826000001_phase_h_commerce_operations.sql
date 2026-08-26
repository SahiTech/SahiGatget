CREATE TABLE IF NOT EXISTS public.carts (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  guest_token TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CONVERTED', 'EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, variant_id)
);
CREATE INDEX IF NOT EXISTS cart_items_cart_idx ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS carts_status_expiry_idx ON public.carts(status, expires_at);

CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  cart_id UUID REFERENCES public.carts(id) ON DELETE SET NULL,
  checkout_request_id TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('QUICK_ORDER', 'CART', 'LANDING_PAGE')),
  status TEXT NOT NULL DEFAULT 'STARTED' CHECK (status IN ('STARTED', 'DETAILS_ENTERED', 'QUOTED', 'PAYMENT_INITIATED', 'ABANDONED', 'COMPLETED')),
  customer_phone TEXT,
  customer_email TEXT,
  quote_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS checkout_sessions_status_activity_idx ON public.checkout_sessions(status, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS checkout_sessions_cart_idx ON public.checkout_sessions(cart_id);

CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  phone_hash TEXT,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  level TEXT NOT NULL CHECK (level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN')),
  action TEXT NOT NULL CHECK (action IN ('ALLOW', 'ALLOW_WITH_VERIFICATION', 'MANUAL_REVIEW', 'REQUIRE_PREPAYMENT', 'TEMPORARILY_RESTRICT', 'BLOCK')),
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  overridden_by UUID,
  override_action TEXT,
  internal_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS risk_assessments_order_idx ON public.risk_assessments(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS risk_assessments_phone_idx ON public.risk_assessments(phone_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS public.commerce_events (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id TEXT NOT NULL UNIQUE,
  event_name TEXT NOT NULL CHECK (event_name IN ('CART_CREATED', 'CART_ITEM_ADDED', 'CART_ITEM_UPDATED', 'CART_ITEM_REMOVED', 'CHECKOUT_STARTED', 'CHECKOUT_QUOTED', 'CHECKOUT_ABANDONED', 'ORDER_COMPLETED', 'PAYMENT_INITIATED', 'PAYMENT_VERIFIED', 'PAYMENT_FAILED', 'RISK_ASSESSED', 'SHIPMENT_CREATED', 'SHIPMENT_TRACKED', 'RETURN_REQUESTED')),
  session_id TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  cart_id UUID REFERENCES public.carts(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS commerce_events_name_time_idx ON public.commerce_events(event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS commerce_events_order_idx ON public.commerce_events(order_id, occurred_at DESC);

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access carts" ON public.carts;
CREATE POLICY "Admin full access carts" ON public.carts FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "Admin full access cart_items" ON public.cart_items;
CREATE POLICY "Admin full access cart_items" ON public.cart_items FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "Admin full access checkout_sessions" ON public.checkout_sessions;
CREATE POLICY "Admin full access checkout_sessions" ON public.checkout_sessions FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "Admin full access risk_assessments" ON public.risk_assessments;
CREATE POLICY "Admin full access risk_assessments" ON public.risk_assessments FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());
DROP POLICY IF EXISTS "Admin full access commerce_events" ON public.commerce_events;
CREATE POLICY "Admin full access commerce_events" ON public.commerce_events FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

REVOKE ALL ON TABLE public.carts, public.cart_items, public.checkout_sessions, public.risk_assessments, public.commerce_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.carts, public.cart_items, public.checkout_sessions, public.risk_assessments, public.commerce_events TO service_role;

-- Multi-item cart checkout reuses the existing guest COD safety model and is
-- executable only by the server-side service-role client.
CREATE OR REPLACE FUNCTION public.create_guest_cod_cart_order(
  p_cart_id UUID,
  p_checkout_request_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT,
  p_division TEXT,
  p_district TEXT,
  p_area TEXT,
  p_address TEXT,
  p_postal_code TEXT,
  p_notes TEXT
)
RETURNS TABLE(order_id UUID, order_number VARCHAR, created_new BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing RECORD;
  v_cart RECORD;
  v_item RECORD;
  v_customer_id UUID;
  v_order_id UUID;
  v_order_number VARCHAR(50);
  v_delivery_config JSONB;
  v_delivery_zone VARCHAR(50);
  v_delivery_charge NUMERIC(10,2);
  v_subtotal NUMERIC(10,2) := 0;
  v_discount_total NUMERIC(10,2) := 0;
  v_item_count INTEGER := 0;
BEGIN
  IF p_checkout_request_id IS NULL OR NULLIF(btrim(p_customer_name), '') IS NULL OR NULLIF(btrim(p_customer_phone), '') IS NULL OR NULLIF(btrim(p_division), '') IS NULL OR NULLIF(btrim(p_district), '') IS NULL OR NULLIF(btrim(p_area), '') IS NULL OR NULLIF(btrim(p_address), '') IS NULL THEN
    RAISE EXCEPTION 'MISSING_CUSTOMER_OR_DELIVERY_DETAILS';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_checkout_request_id::text));
  SELECT id, order_number INTO v_existing FROM public.orders WHERE checkout_request_id = p_checkout_request_id;
  IF FOUND THEN RETURN QUERY SELECT v_existing.id, v_existing.order_number, FALSE; RETURN; END IF;
  SELECT id INTO v_cart FROM public.carts WHERE id = p_cart_id AND status = 'ACTIVE' AND expires_at > NOW() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CART_UNAVAILABLE'; END IF;
  SELECT value INTO v_delivery_config FROM public.settings WHERE key = 'delivery_charges';
  IF lower(btrim(p_division)) = 'dhaka' THEN v_delivery_zone := 'dhaka'; v_delivery_charge := NULLIF(v_delivery_config ->> 'dhaka', '')::NUMERIC; ELSE v_delivery_zone := 'outside_dhaka'; v_delivery_charge := NULLIF(v_delivery_config ->> 'outside_dhaka', '')::NUMERIC; END IF;
  IF v_delivery_charge IS NULL OR v_delivery_charge < 0 THEN RAISE EXCEPTION 'DELIVERY_SETTINGS_UNAVAILABLE'; END IF;
  FOR v_item IN
    SELECT ci.quantity, pv.id AS variant_id, pv.sku, pv.variant_title, pv.price, pv.compare_at_price, pv.stock_quantity, pv.is_active, p.id AS product_id, p.name AS product_name, p.is_published, p.warranty_policy
    FROM public.cart_items ci
    INNER JOIN public.products p ON p.id = ci.product_id
    INNER JOIN public.product_variants pv ON pv.id = ci.variant_id AND pv.product_id = ci.product_id
    WHERE ci.cart_id = p_cart_id
    FOR UPDATE OF pv
  LOOP
    v_item_count := v_item_count + 1;
    IF v_item.is_published IS NOT TRUE OR v_item.is_active IS NOT TRUE THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
    IF v_item.stock_quantity < v_item.quantity THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
    v_subtotal := v_subtotal + (v_item.price * v_item.quantity);
    v_discount_total := v_discount_total + (GREATEST(COALESCE(v_item.compare_at_price, v_item.price) - v_item.price, 0) * v_item.quantity);
  END LOOP;
  IF v_item_count = 0 THEN RAISE EXCEPTION 'CART_EMPTY'; END IF;
  v_order_number := 'SG-' || to_char(NOW() AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || upper(substr(replace(extensions.uuid_generate_v4()::text, '-', ''), 1, 8));
  INSERT INTO public.customers (full_name, phone, email) VALUES (btrim(p_customer_name), btrim(p_customer_phone), NULLIF(btrim(p_customer_email), '')) RETURNING id INTO v_customer_id;
  INSERT INTO public.customer_addresses (customer_id, division, district, area, address, postal_code, is_default) VALUES (v_customer_id, btrim(p_division), btrim(p_district), btrim(p_area), btrim(p_address), NULLIF(btrim(p_postal_code), ''), TRUE);
  INSERT INTO public.orders (order_number, customer_id, checkout_request_id, subtotal, discount_total, delivery_charge, grand_total, payment_method, payment_status, order_status, delivery_zone, shipping_address, shipping_area, shipping_division, shipping_district, shipping_postal_code, customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot, notes, tracking_token) VALUES (v_order_number, v_customer_id, p_checkout_request_id, v_subtotal, v_discount_total, v_delivery_charge, v_subtotal + v_delivery_charge, 'COD', 'pending', 'PENDING', v_delivery_zone, btrim(p_address), btrim(p_area), btrim(p_division), btrim(p_district), NULLIF(btrim(p_postal_code), ''), btrim(p_customer_name), btrim(p_customer_phone), NULLIF(btrim(p_customer_email), ''), NULLIF(btrim(p_notes), ''), replace(extensions.uuid_generate_v4()::text, '-', '')) RETURNING id INTO v_order_id;
  FOR v_item IN
    SELECT ci.quantity, pv.id AS variant_id, pv.sku, pv.variant_title, pv.price, pv.compare_at_price, p.id AS product_id, p.name AS product_name, p.warranty_policy
    FROM public.cart_items ci INNER JOIN public.products p ON p.id = ci.product_id INNER JOIN public.product_variants pv ON pv.id = ci.variant_id AND pv.product_id = ci.product_id WHERE ci.cart_id = p_cart_id FOR UPDATE OF pv
  LOOP
    INSERT INTO public.order_items (order_id, product_id, variant_id, sku, product_name_snapshot, variant_title_snapshot, unit_price, compare_at_price_snapshot, discount_amount, quantity, line_total, warranty_policy_snapshot) VALUES (v_order_id, v_item.product_id, v_item.variant_id, v_item.sku, v_item.product_name, v_item.variant_title, v_item.price, v_item.compare_at_price, GREATEST(COALESCE(v_item.compare_at_price, v_item.price) - v_item.price, 0) * v_item.quantity, v_item.quantity, v_item.price * v_item.quantity, v_item.warranty_policy);
    UPDATE public.product_variants SET stock_quantity = stock_quantity - v_item.quantity, updated_at = NOW() WHERE id = v_item.variant_id;
    INSERT INTO public.stock_movements (variant_id, change_amount, movement_type, reference_id, notes) VALUES (v_item.variant_id, -v_item.quantity, 'SALE', v_order_id, 'Guest COD cart order ' || v_order_number);
  END LOOP;
  INSERT INTO public.order_status_history (order_id, previous_status, new_status, notes) VALUES (v_order_id, NULL, 'PENDING', 'Guest Cash on Delivery cart order created');
  UPDATE public.carts SET status = 'CONVERTED', updated_at = NOW() WHERE id = p_cart_id;
  RETURN QUERY SELECT v_order_id, v_order_number, TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_cod_cart_order(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_cod_cart_order(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
