-- Harden direct FULL_ADVANCE stock lifecycle.
-- A pending advance-payment order reserves stock; payment success commits the
-- reservation, while failed/cancelled/expired payment releases it exactly once.
-- This migration intentionally reuses the existing guest-order RPC so pricing,
-- customer snapshots, order items and checkout idempotency remain centralized.

CREATE OR REPLACE FUNCTION public.reserve_advance_order_stock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item RECORD;
  v_reserved BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_order_id::text));

  SELECT EXISTS (
    SELECT 1
    FROM public.stock_movements
    WHERE reference_id = p_order_id
      AND movement_type = 'RESERVATION'
  ) INTO v_reserved;

  IF v_reserved THEN
    RETURN;
  END IF;

  FOR v_item IN
    SELECT oi.variant_id, oi.quantity, oi.sku
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
    FOR UPDATE
  LOOP
    UPDATE public.product_variants
    SET stock_quantity = stock_quantity - v_item.quantity,
        updated_at = NOW()
    WHERE id = v_item.variant_id
      AND stock_quantity >= v_item.quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK';
    END IF;

    INSERT INTO public.stock_movements (
      variant_id, change_amount, movement_type, reference_id, notes
    ) VALUES (
      v_item.variant_id,
      -v_item.quantity,
      'RESERVATION',
      p_order_id,
      'Advance-payment stock reservation'
    );
  END LOOP;

  UPDATE public.orders
  SET payment_status = 'pending',
      order_status = 'PENDING',
      updated_at = NOW()
  WHERE id = p_order_id
    AND payment_status <> 'paid';
END;
$$;

CREATE OR REPLACE FUNCTION public.release_advance_order_stock(p_order_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_order_id::text));

  FOR v_item IN
    SELECT sm.variant_id, ABS(sm.change_amount) AS quantity
    FROM public.stock_movements sm
    WHERE sm.reference_id = p_order_id
      AND sm.movement_type = 'RESERVATION'
    FOR UPDATE
  LOOP
    UPDATE public.product_variants
    SET stock_quantity = stock_quantity + v_item.quantity,
        updated_at = NOW()
    WHERE id = v_item.variant_id;

    INSERT INTO public.stock_movements (
      variant_id, change_amount, movement_type, reference_id, notes
    ) VALUES (
      v_item.variant_id,
      v_item.quantity,
      'RELEASE',
      p_order_id,
      COALESCE(p_reason, 'Advance-payment reservation released')
    );
  END LOOP;

  UPDATE public.stock_movements
  SET movement_type = 'RELEASED'
  WHERE reference_id = p_order_id
    AND movement_type = 'RESERVATION';
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_advance_order_stock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_order_id::text));

  IF NOT EXISTS (
    SELECT 1 FROM public.stock_movements
    WHERE reference_id = p_order_id AND movement_type = 'RESERVATION'
  ) THEN
    RAISE EXCEPTION 'ADVANCE_RESERVATION_MISSING';
  END IF;

  UPDATE public.stock_movements
  SET movement_type = 'SALE',
      notes = 'Advance payment verified; reservation committed to sale'
  WHERE reference_id = p_order_id
    AND movement_type = 'RESERVATION';

  UPDATE public.orders
  SET payment_status = 'paid',
      order_status = 'CONFIRMED',
      updated_at = NOW()
  WHERE id = p_order_id;
END;
$$;

-- Replace the bridge so a newly-created advance order converts its initial
-- stock deduction into a reservation, and retries re-reserve stock after a
-- previous failed/cancelled/expired payment released it.
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
  v_payment_method TEXT;
  v_payment_status TEXT;
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

  SELECT payment_method, payment_status
    INTO v_payment_method, v_payment_status
    FROM public.orders
    WHERE id = v_order_id;

  -- Never convert an already-created COD order into an online-payment order.
  IF v_created_new IS FALSE AND v_payment_method = 'COD' THEN
    RETURN QUERY SELECT v_order_id, v_order_number, FALSE;
    RETURN;
  END IF;

  IF v_created_new IS TRUE THEN
    UPDATE public.orders
    SET payment_method = 'BDGATE',
        payment_status = 'pending',
        payment_requirement = 'FULL_ADVANCE',
        order_status = 'PENDING',
        updated_at = NOW()
    WHERE id = v_order_id;

    -- The underlying guest COD RPC already deducted stock. Convert that ledger
    -- entry into a reservation so payment outcome controls its final lifecycle.
    UPDATE public.stock_movements
    SET movement_type = 'RESERVATION',
        notes = 'Advance-payment stock reservation'
    WHERE reference_id = v_order_id
      AND movement_type = 'SALE';
  ELSIF v_payment_status <> 'paid' THEN
    PERFORM public.reserve_advance_order_stock(v_order_id);
  END IF;

  RETURN QUERY SELECT v_order_id, v_order_number, COALESCE(v_created_new, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_advance_payment_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.payment_requirement <> 'FULL_ADVANCE' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'PAID' AND NEW.status IS DISTINCT FROM 'PAID' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_TRANSITION_PAID_TERMINAL';
  END IF;

  IF OLD.status IN ('FAILED', 'CANCELLED', 'EXPIRED')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_TRANSITION_TERMINAL';
  END IF;

  IF NEW.status = 'PAID'
     AND OLD.status NOT IN ('INITIATED', 'PENDING', 'AUTHORIZED', 'PAID') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_TRANSITION_TO_PAID';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_advance_payment_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.payment_requirement <> 'FULL_ADVANCE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'PAID' AND OLD.status IS DISTINCT FROM 'PAID' THEN
    PERFORM public.finalize_advance_order_stock(NEW.order_id);
  ELSIF NEW.status IN ('FAILED', 'CANCELLED', 'EXPIRED')
        AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.release_advance_order_stock(
      NEW.order_id,
      'Advance-payment ' || lower(NEW.status) || '; reservation released'
    );
    UPDATE public.orders
    SET payment_status = lower(NEW.status),
        order_status = 'CANCELLED',
        updated_at = NOW()
    WHERE id = NEW.order_id
      AND payment_status <> 'paid';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_advance_payment_transition_guard ON public.payment_transactions;
CREATE TRIGGER trg_advance_payment_transition_guard
BEFORE UPDATE OF status ON public.payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_advance_payment_transition();

DROP TRIGGER IF EXISTS trg_advance_payment_stock_lifecycle ON public.payment_transactions;
CREATE TRIGGER trg_advance_payment_stock_lifecycle
AFTER UPDATE OF status ON public.payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_advance_payment_transition();

REVOKE ALL ON FUNCTION public.reserve_advance_order_stock(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_advance_order_stock(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_advance_order_stock(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_advance_payment_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_advance_payment_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_guest_advance_order(UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_advance_order(UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.create_guest_advance_order(UUID, UUID, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
IS 'Creates or resumes a server-authoritative FULL_ADVANCE order with stock reservation semantics; payment outcome commits or releases the reservation.';

NOTIFY pgrst, 'reload schema';
