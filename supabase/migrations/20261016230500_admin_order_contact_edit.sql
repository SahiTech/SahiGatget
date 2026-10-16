-- Keep order contact and delivery edits atomic; reprice delivery from current admin settings.
CREATE OR REPLACE FUNCTION public.admin_update_order_contact_details(
  p_order_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_shipping_address text,
  p_shipping_area text,
  p_shipping_district text,
  p_shipping_division text,
  p_shipping_postal_code text,
  p_notes text,
  p_actor_id uuid
)
RETURNS TABLE(updated_order_id uuid, updated_order_number text, updated_delivery_charge numeric, updated_grand_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_delivery_config jsonb;
  v_delivery_zone text;
  v_delivery_charge numeric(10,2);
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_order.order_status NOT IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'READY_TO_SHIP') THEN
    RAISE EXCEPTION 'ORDER_NOT_ELIGIBLE_FOR_EDIT';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shipments WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'ORDER_HAS_SHIPMENT';
  END IF;
  IF v_order.payment_requirement <> 'COD' OR lower(v_order.payment_status) <> 'pending'
    OR EXISTS (SELECT 1 FROM public.payment_transactions WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'ORDER_HAS_PAYMENT_ACTIVITY';
  END IF;

  SELECT value INTO v_delivery_config FROM public.settings WHERE key = 'delivery_charges';
  IF lower(btrim(p_shipping_division)) = 'dhaka' THEN
    v_delivery_zone := 'dhaka';
    v_delivery_charge := NULLIF(v_delivery_config ->> 'dhaka', '')::numeric;
  ELSE
    v_delivery_zone := 'outside_dhaka';
    v_delivery_charge := NULLIF(v_delivery_config ->> 'outside_dhaka', '')::numeric;
  END IF;
  IF v_delivery_charge IS NULL OR v_delivery_charge < 0 THEN
    RAISE EXCEPTION 'DELIVERY_SETTINGS_UNAVAILABLE';
  END IF;

  UPDATE public.customers
  SET full_name = btrim(p_customer_name),
      phone = btrim(p_customer_phone),
      email = NULLIF(btrim(COALESCE(p_customer_email, '')), ''),
      updated_at = NOW()
  WHERE id = v_order.customer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_NOT_FOUND'; END IF;

  UPDATE public.orders
  SET customer_name_snapshot = btrim(p_customer_name),
      customer_phone_snapshot = btrim(p_customer_phone),
      customer_email_snapshot = NULLIF(btrim(COALESCE(p_customer_email, '')), ''),
      shipping_address = btrim(p_shipping_address),
      shipping_area = btrim(p_shipping_area),
      shipping_district = btrim(p_shipping_district),
      shipping_division = btrim(p_shipping_division),
      shipping_postal_code = NULLIF(btrim(COALESCE(p_shipping_postal_code, '')), ''),
      delivery_zone = v_delivery_zone,
      delivery_charge = v_delivery_charge,
      grand_total = subtotal - discount_total + v_delivery_charge,
      notes = NULLIF(btrim(COALESCE(p_notes, '')), ''),
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN QUERY SELECT p_order_id, v_order.order_number, v_delivery_charge, v_order.subtotal - v_order.discount_total + v_delivery_charge;
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_update_order_contact_details(uuid, text, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_order_contact_details(uuid, text, text, text, text, text, text, text, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_update_order_contact_details(uuid, text, text, text, text, text, text, text, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_order_contact_details(uuid, text, text, text, text, text, text, text, text, text, uuid) TO service_role;
