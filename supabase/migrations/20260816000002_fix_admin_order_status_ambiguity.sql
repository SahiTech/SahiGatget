-- Fix the status-transition RPC ambiguity caused by the RETURNS TABLE(order_status text)
-- output column colliding with public.orders.order_status.
-- The signature, permissions, atomic update/history behavior, and canonical statuses
-- remain unchanged; only table qualification is hardened.
CREATE OR REPLACE FUNCTION public.update_admin_order_status(
  p_order_id uuid,
  p_new_status text,
  p_notes text,
  p_actor_id uuid
)
RETURNS TABLE(order_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_previous_status text;
  v_actor_role text;
BEGIN
  SELECT private.admin_role_for(p_actor_id) INTO v_actor_role;
  IF v_actor_role NOT IN ('OWNER', 'ADMIN', 'STAFF') THEN
    RAISE EXCEPTION 'ADMIN_FORBIDDEN';
  END IF;

  IF p_new_status NOT IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED') THEN
    RAISE EXCEPTION 'INVALID_ORDER_STATUS';
  END IF;

  SELECT o.order_status
  INTO v_previous_status
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_previous_status = p_new_status THEN
    RAISE EXCEPTION 'ORDER_STATUS_UNCHANGED';
  END IF;

  UPDATE public.orders AS o
  SET order_status = p_new_status,
      updated_at = now()
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_UPDATE_FAILED';
  END IF;

  INSERT INTO public.order_status_history (order_id, previous_status, new_status, notes, changed_by)
  VALUES (p_order_id, v_previous_status, p_new_status, nullif(trim(p_notes), ''), p_actor_id);

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    p_actor_id,
    'ORDER_STATUS_UPDATED',
    'order',
    p_order_id,
    jsonb_build_object('previous_status', v_previous_status, 'new_status', p_new_status)
  );

  RETURN QUERY SELECT p_new_status;
END;
$$;

REVOKE ALL ON FUNCTION public.update_admin_order_status(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_order_status(uuid, text, text, uuid) TO service_role;
