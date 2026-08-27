-- Cart FULL_ADVANCE bridge.
-- Reuses the authoritative Cart order RPC and converts its initial SALE ledger
-- entry into a reservation in the same transaction, matching Direct Checkout.
CREATE OR REPLACE FUNCTION public.create_guest_advance_cart_order(
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
  v_order_id UUID;
  v_order_number VARCHAR(50);
  v_created_new BOOLEAN;
  v_payment_method TEXT;
  v_payment_status TEXT;
BEGIN
  SELECT result.order_id, result.order_number, result.created_new
    INTO v_order_id, v_order_number, v_created_new
    FROM public.create_guest_cod_cart_order(
      p_cart_id, p_checkout_request_id, p_customer_name, p_customer_phone,
      p_customer_email, p_division, p_district, p_area, p_address,
      p_postal_code, p_notes
    ) AS result
    LIMIT 1;

  IF v_order_id IS NULL THEN RAISE EXCEPTION 'ADVANCE_CART_ORDER_CREATION_FAILED'; END IF;

  SELECT payment_method, payment_status INTO v_payment_method, v_payment_status
  FROM public.orders WHERE id = v_order_id;

  IF v_created_new IS FALSE AND v_payment_method = 'COD' THEN
    RETURN QUERY SELECT v_order_id, v_order_number, FALSE;
    RETURN;
  END IF;

  IF v_created_new IS TRUE THEN
    UPDATE public.orders
    SET payment_method = 'BDGATE', payment_status = 'pending',
        payment_requirement = 'FULL_ADVANCE', order_status = 'PENDING', updated_at = NOW()
    WHERE id = v_order_id;

    UPDATE public.stock_movements
    SET movement_type = 'RESERVATION', notes = 'Advance-payment stock reservation'
    WHERE reference_id = v_order_id AND movement_type = 'SALE';
  ELSIF v_payment_status <> 'paid' THEN
    PERFORM public.reserve_advance_order_stock(v_order_id);
  END IF;

  RETURN QUERY SELECT v_order_id, v_order_number, COALESCE(v_created_new, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_advance_cart_order(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_advance_cart_order(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.create_guest_advance_cart_order(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
IS 'Creates or resumes a server-authoritative Cart FULL_ADVANCE order; payment outcome commits or releases reserved stock.';

NOTIFY pgrst, 'reload schema';

-- Keep the test-only dblink extension out of application migrations; the runtime
-- SQL test creates it in the disposable CI database when needed.
SELECT 1;
