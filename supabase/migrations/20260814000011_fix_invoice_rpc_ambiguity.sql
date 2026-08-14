-- Fix invoice_number column ambiguity in ensure_invoice_for_order
-- Applies only to the isolated SahiGatget Supabase project.

DROP FUNCTION IF EXISTS public.ensure_invoice_for_order(UUID);

CREATE OR REPLACE FUNCTION public.ensure_invoice_for_order(p_order_id UUID)
RETURNS TABLE(invoice_id UUID, invoice_number VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_existing RECORD;
  v_store_profile JSONB;
  v_return_policy TEXT;
  v_invoice_id UUID;
  v_invoice_number VARCHAR(50);
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_REQUIRED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('sahigadget-invoice:' || p_order_id::TEXT));

  SELECT id, invoices.invoice_number
  INTO v_existing
  FROM public.invoices
  WHERE order_id = p_order_id;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, v_existing.invoice_number;
    RETURN;
  END IF;

  SELECT
    o.id,
    o.order_number,
    o.subtotal,
    o.discount_total,
    o.delivery_charge,
    o.grand_total,
    o.payment_method,
    o.payment_status,
    o.order_status,
    o.shipping_address,
    o.shipping_area,
    o.shipping_division,
    o.shipping_district,
    o.shipping_postal_code,
    o.customer_name_snapshot,
    o.customer_phone_snapshot,
    o.customer_email_snapshot,
    o.created_at
  INTO v_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  SELECT COALESCE(s.value, '{}'::jsonb)
  INTO v_store_profile
  FROM public.settings AS s
  WHERE s.key = 'store_profile';

  SELECT COALESCE(s.value ->> 'policy_text', '')
  INTO v_return_policy
  FROM public.settings AS s
  WHERE s.key = 'return_refund_policy';

  v_invoice_number := 'INV-' || to_char(v_order.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || lpad(nextval('public.invoice_number_seq')::TEXT, 6, '0');

  INSERT INTO public.invoices (
    invoice_number,
    order_id,
    subtotal,
    discount_total,
    delivery_charge,
    grand_total,
    order_number_snapshot,
    customer_name_snapshot,
    customer_phone_snapshot,
    customer_email_snapshot,
    shipping_address_snapshot,
    shipping_division_snapshot,
    shipping_district_snapshot,
    shipping_area_snapshot,
    shipping_postal_code_snapshot,
    payment_method_snapshot,
    payment_status_snapshot,
    order_status_snapshot,
    warranty_policy_snapshot,
    return_refund_policy_snapshot,
    store_profile_snapshot
  )
  VALUES (
    v_invoice_number,
    v_order.id,
    v_order.subtotal,
    v_order.discount_total,
    v_order.delivery_charge,
    v_order.grand_total,
    v_order.order_number,
    v_order.customer_name_snapshot,
    v_order.customer_phone_snapshot,
    v_order.customer_email_snapshot,
    v_order.shipping_address,
    v_order.shipping_division,
    v_order.shipping_district,
    v_order.shipping_area,
    v_order.shipping_postal_code,
    v_order.payment_method,
    v_order.payment_status,
    v_order.order_status,
    NULL,
    v_return_policy,
    v_store_profile
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_items (
    invoice_id,
    sku,
    product_name_snapshot,
    variant_title_snapshot,
    imei_snapshot,
    imei_2_snapshot,
    serial_number_snapshot,
    unit_price,
    compare_at_price_snapshot,
    discount_amount,
    quantity,
    line_total,
    warranty_policy_snapshot
  )
  SELECT
    v_invoice_id,
    oi.sku,
    oi.product_name_snapshot,
    oi.variant_title_snapshot,
    serial_data.imei_1,
    serial_data.imei_2,
    serial_data.serial_number,
    oi.unit_price,
    oi.compare_at_price_snapshot,
    oi.discount_amount,
    oi.quantity,
    oi.line_total,
    oi.warranty_policy_snapshot
  FROM public.order_items AS oi
  LEFT JOIN LATERAL (
    SELECT i.imei_1, i.imei_2, i.serial_number
    FROM public.imei_inventory AS i
    WHERE i.order_id = v_order.id
      AND i.variant_id = oi.variant_id
    ORDER BY i.created_at ASC
    LIMIT 1
  ) AS serial_data ON TRUE
  WHERE oi.order_id = v_order.id
  ORDER BY oi.created_at ASC;

  SELECT i.invoice_number INTO v_invoice_number
  FROM public.invoices AS i
  WHERE i.id = v_invoice_id;

  RETURN QUERY SELECT v_invoice_id, v_invoice_number;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_invoice_for_order(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_invoice_for_order(UUID) TO service_role;
