-- Phase 4: customer guest ordering and Cash on Delivery foundation.
-- Applies only to the isolated SahiGatget Supabase project.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_request_id UUID,
  ADD COLUMN IF NOT EXISTS customer_email_snapshot VARCHAR(255),
  ADD COLUMN IF NOT EXISTS shipping_division VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_district VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_checkout_request_id
  ON public.orders(checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS compare_at_price_snapshot DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0.00 NOT NULL CHECK (discount_amount >= 0),
  ADD COLUMN IF NOT EXISTS warranty_policy_snapshot TEXT;

-- Seed only the public business values required by checkout, without overwriting
-- a future administrator-configured value.
INSERT INTO public.settings (key, value, description)
VALUES
  ('delivery_charges', '{"dhaka":80,"outside_dhaka":130}'::jsonb, 'Customer delivery charges in BDT'),
  ('business_policy', '{"guarantee_days":7,"service_warranty_years":1,"policy_text":"7 Days Guarantee & 1 Year Service Warranty. Manufacturer warranty terms apply where applicable."}'::jsonb, 'Customer-facing warranty policy')
ON CONFLICT (key) DO NOTHING;

-- The transaction is not a public RPC. It may be invoked only by the server-side
-- service-role client, and it re-fetches every authoritative commercial value.
CREATE OR REPLACE FUNCTION public.create_guest_cod_order(
  p_product_id UUID,
  p_variant_id UUID,
  p_quantity INTEGER,
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
  v_product_name VARCHAR(255);
  v_product_published BOOLEAN;
  v_warranty_policy TEXT;
  v_variant_sku VARCHAR(100);
  v_variant_title VARCHAR(255);
  v_variant_active BOOLEAN;
  v_variant_price NUMERIC(10,2);
  v_variant_compare_at_price NUMERIC(10,2);
  v_stock_quantity INTEGER;
  v_customer_id UUID;
  v_order_id UUID;
  v_order_number VARCHAR(50);
  v_delivery_config JSONB;
  v_delivery_zone VARCHAR(50);
  v_delivery_charge NUMERIC(10,2);
  v_subtotal NUMERIC(10,2);
  v_discount_total NUMERIC(10,2);
  v_grand_total NUMERIC(10,2);
  v_existing_order RECORD;
BEGIN
  IF p_checkout_request_id IS NULL THEN
    RAISE EXCEPTION 'CHECKOUT_REQUEST_REQUIRED';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 10 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;
  IF NULLIF(btrim(p_customer_name), '') IS NULL
     OR NULLIF(btrim(p_customer_phone), '') IS NULL
     OR NULLIF(btrim(p_division), '') IS NULL
     OR NULLIF(btrim(p_district), '') IS NULL
     OR NULLIF(btrim(p_area), '') IS NULL
     OR NULLIF(btrim(p_address), '') IS NULL THEN
    RAISE EXCEPTION 'MISSING_CUSTOMER_OR_DELIVERY_DETAILS';
  END IF;

  -- Serializes repeated submissions for the same client-generated request ID.
  PERFORM pg_advisory_xact_lock(hashtext(p_checkout_request_id::text));

  SELECT id, order_number
    INTO v_existing_order
    FROM public.orders
    WHERE checkout_request_id = p_checkout_request_id;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing_order.id, v_existing_order.order_number, FALSE;
    RETURN;
  END IF;

  -- Locks the selected variant to prevent concurrent orders from overselling it.
  SELECT
    product.name,
    product.is_published,
    product.warranty_policy,
    variant.sku,
    variant.variant_title,
    variant.is_active,
    variant.price,
    variant.compare_at_price,
    variant.stock_quantity
  INTO
    v_product_name,
    v_product_published,
    v_warranty_policy,
    v_variant_sku,
    v_variant_title,
    v_variant_active,
    v_variant_price,
    v_variant_compare_at_price,
    v_stock_quantity
  FROM public.products AS product
  INNER JOIN public.product_variants AS variant ON variant.product_id = product.id
  WHERE product.id = p_product_id
    AND variant.id = p_variant_id
  FOR UPDATE OF variant;

  IF NOT FOUND OR v_product_published IS NOT TRUE OR v_variant_active IS NOT TRUE THEN
    RAISE EXCEPTION 'PRODUCT_UNAVAILABLE';
  END IF;
  IF v_stock_quantity < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  SELECT value
    INTO v_delivery_config
    FROM public.settings
    WHERE key = 'delivery_charges';

  IF v_delivery_config IS NULL THEN
    RAISE EXCEPTION 'DELIVERY_SETTINGS_UNAVAILABLE';
  END IF;

  IF lower(btrim(p_division)) = 'dhaka' THEN
    v_delivery_zone := 'dhaka';
    v_delivery_charge := NULLIF(v_delivery_config ->> 'dhaka', '')::NUMERIC;
  ELSE
    v_delivery_zone := 'outside_dhaka';
    v_delivery_charge := NULLIF(v_delivery_config ->> 'outside_dhaka', '')::NUMERIC;
  END IF;

  IF v_delivery_charge IS NULL OR v_delivery_charge < 0 THEN
    RAISE EXCEPTION 'DELIVERY_SETTINGS_UNAVAILABLE';
  END IF;

  v_subtotal := v_variant_price * p_quantity;
  v_discount_total := GREATEST(COALESCE(v_variant_compare_at_price, v_variant_price) - v_variant_price, 0) * p_quantity;
  v_grand_total := v_subtotal + v_delivery_charge;
  v_order_number := 'SG-' || to_char(now() AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || upper(substr(replace(extensions.uuid_generate_v4()::text, '-', ''), 1, 8));

  INSERT INTO public.customers (full_name, phone, email)
  VALUES (btrim(p_customer_name), btrim(p_customer_phone), NULLIF(btrim(p_customer_email), ''))
  RETURNING id INTO v_customer_id;

  INSERT INTO public.customer_addresses (customer_id, division, district, area, address, postal_code, is_default)
  VALUES (
    v_customer_id,
    btrim(p_division),
    btrim(p_district),
    btrim(p_area),
    btrim(p_address),
    NULLIF(btrim(p_postal_code), ''),
    TRUE
  );

  INSERT INTO public.orders (
    order_number,
    customer_id,
    checkout_request_id,
    subtotal,
    discount_total,
    delivery_charge,
    grand_total,
    payment_method,
    payment_status,
    order_status,
    delivery_zone,
    shipping_address,
    shipping_area,
    shipping_division,
    shipping_district,
    shipping_postal_code,
    customer_name_snapshot,
    customer_phone_snapshot,
    customer_email_snapshot,
    notes,
    tracking_token
  )
  VALUES (
    v_order_number,
    v_customer_id,
    p_checkout_request_id,
    v_subtotal,
    v_discount_total,
    v_delivery_charge,
    v_grand_total,
    'COD',
    'pending',
    'PENDING',
    v_delivery_zone,
    btrim(p_address),
    btrim(p_area),
    btrim(p_division),
    btrim(p_district),
    NULLIF(btrim(p_postal_code), ''),
    btrim(p_customer_name),
    btrim(p_customer_phone),
    NULLIF(btrim(p_customer_email), ''),
    NULLIF(btrim(p_notes), ''),
    replace(extensions.uuid_generate_v4()::text, '-', '')
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (
    order_id,
    product_id,
    variant_id,
    sku,
    product_name_snapshot,
    variant_title_snapshot,
    unit_price,
    compare_at_price_snapshot,
    discount_amount,
    quantity,
    line_total,
    warranty_policy_snapshot
  )
  VALUES (
    v_order_id,
    p_product_id,
    p_variant_id,
    v_variant_sku,
    v_product_name,
    v_variant_title,
    v_variant_price,
    v_variant_compare_at_price,
    GREATEST(COALESCE(v_variant_compare_at_price, v_variant_price) - v_variant_price, 0) * p_quantity,
    p_quantity,
    v_subtotal,
    v_warranty_policy
  );

  UPDATE public.product_variants
  SET stock_quantity = stock_quantity - p_quantity,
      updated_at = NOW()
  WHERE id = p_variant_id;

  INSERT INTO public.stock_movements (variant_id, change_amount, movement_type, reference_id, notes)
  VALUES (p_variant_id, -p_quantity, 'SALE', v_order_id, 'Guest COD order ' || v_order_number);

  INSERT INTO public.order_status_history (order_id, previous_status, new_status, notes)
  VALUES (v_order_id, NULL, 'PENDING', 'Guest Cash on Delivery order created');

  RETURN QUERY SELECT v_order_id, v_order_number, TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_cod_order(
  UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_cod_order(
  UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;
