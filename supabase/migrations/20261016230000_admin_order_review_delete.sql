-- Safely remove only an unshipped, unpaid fake order while reversing its net stock movement.
-- The admin action performs role validation and writes the audit log separately.
CREATE OR REPLACE FUNCTION public.admin_delete_unshipped_fake_order(
  p_order_id uuid,
  p_actor_id uuid
)
RETURNS TABLE(deleted_order_id uuid, deleted_order_number text, restored_stock_variants integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_movement record;
  v_restored integer := 0;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_order.order_status <> 'PENDING' OR lower(v_order.payment_status) <> 'pending' THEN
    RAISE EXCEPTION 'ORDER_NOT_ELIGIBLE_FOR_DELETION';
  END IF;

  IF EXISTS (SELECT 1 FROM public.shipments WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'ORDER_HAS_SHIPMENT';
  END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'ORDER_HAS_INVOICE';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_transactions WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'ORDER_HAS_PAYMENT_ACTIVITY';
  END IF;
  IF EXISTS (SELECT 1 FROM public.imei_inventory WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'ORDER_HAS_SERIALIZED_INVENTORY';
  END IF;

  -- Reverse the net stock change for each variant exactly once. The order row lock
  -- serializes duplicate delete attempts; the stock updates and order deletion are
  -- part of the same database transaction.
  FOR v_movement IN
    SELECT sm.variant_id, SUM(sm.change_amount)::integer AS net_change
    FROM public.stock_movements AS sm
    WHERE sm.reference_id = p_order_id
    GROUP BY sm.variant_id
    HAVING SUM(sm.change_amount) < 0
  LOOP
    UPDATE public.product_variants
    SET stock_quantity = stock_quantity + (-v_movement.net_change),
        updated_at = NOW()
    WHERE id = v_movement.variant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ORDER_STOCK_VARIANT_NOT_FOUND';
    END IF;

    INSERT INTO public.stock_movements
      (variant_id, change_amount, movement_type, reference_id, notes, created_by)
    VALUES
      (v_movement.variant_id, -v_movement.net_change, 'RETURN', p_order_id,
       'Stock restored when admin removed fake/unshipped order ' || v_order.order_number,
       p_actor_id);

    v_restored := v_restored + 1;
  END LOOP;

  DELETE FROM public.orders WHERE id = p_order_id;

  RETURN QUERY SELECT p_order_id, v_order.order_number, v_restored;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_delete_unshipped_fake_order(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_unshipped_fake_order(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_delete_unshipped_fake_order(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_unshipped_fake_order(uuid, uuid) TO service_role;
