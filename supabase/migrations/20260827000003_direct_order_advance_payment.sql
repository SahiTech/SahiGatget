-- Direct-order advance-payment bridge.
-- Reuses the existing authoritative guest-order RPC so pricing, delivery,
-- stock locking, idempotency, customer snapshots, and order items remain one source of truth.
CREATE OR REPLACE FUNCTION public.create_guest_advance_order(
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
  v_order_id UUID;
  v_order_number VARCHAR(50);
  v_created_new BOOLEAN;
BEGIN
  SELECT result.order_id, result.order_number, result.created_new
    INTO v_order_id, v_order_number, v_created_new
    FROM public.create_guest_cod_order(
      p_product_id,
      p_variant_id,
      p_quantity,
      p_checkout_request_id,
      p_customer_name,
      p_customer_phone,
      p_customer_email,
      p_division,
      p_district,
      p_area,
      p_address,
      p_postal_code,
      p_notes
    ) AS result
    LIMIT 1;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'ADVANCE_ORDER_CREATION_FAILED';
  END IF;

  -- An existing request is returned unchanged. This preserves the original
  -- payment method and prevents a repeated request from converting COD into
  -- an online-payment order.
  IF v_created_new IS TRUE THEN
    UPDATE public.orders
    SET payment_method = 'BDGATE',
        payment_status = 'pending',
        payment_requirement = 'FULL_ADVANCE',
        updated_at = NOW()
    WHERE id = v_order_id;

    UPDATE public.order_status_history
    SET notes = 'Guest advance-payment order created; payment required before fulfillment.'
    WHERE order_id = v_order_id
      AND previous_status IS NULL
      AND new_status = 'PENDING';
  END IF;

  RETURN QUERY SELECT v_order_id, v_order_number, COALESCE(v_created_new, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_advance_order(
  UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_advance_order(
  UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.create_guest_advance_order(UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
IS 'Creates a server-authoritative pending full-advance order by reusing the existing guest order RPC; payment is initiated separately by the server payment service.';

NOTIFY pgrst, 'reload schema';
