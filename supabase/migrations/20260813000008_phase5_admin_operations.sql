-- ============================================================================
-- Phase 5: secure administrative operations for the isolated SahiGatget project
-- ============================================================================

-- Role helpers remain in the private schema. The role-aware helper is used by
-- RLS as defense in depth; server actions remain the primary authority boundary.
CREATE OR REPLACE FUNCTION private.admin_role_for(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role
  FROM public.admin_users
  WHERE user_id = p_user_id
    AND is_active = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.has_role(p_allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE user_id = auth.uid()
        AND is_active = TRUE
        AND role = ANY(p_allowed_roles)
    );
$$;

-- Policies call this helper during authenticated RLS evaluation.
GRANT EXECUTE ON FUNCTION private.has_role(text[]) TO authenticated;
REVOKE ALL ON FUNCTION private.admin_role_for(uuid) FROM PUBLIC, anon, authenticated;

-- Public product-image metadata only. Storage paths describe public catalogue
-- media and never contain customer, IMEI, invoice, or operational documents.
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  image_url text NOT NULL,
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_primary boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_one_primary
  ON public.product_images(product_id)
  WHERE is_primary;
CREATE INDEX IF NOT EXISTS idx_product_images_product_order
  ON public.product_images(product_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders(order_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_variants_low_stock
  ON public.product_variants(stock_quantity, low_stock_threshold)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_customers_phone
  ON public.customers(phone);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read product images" ON public.product_images;
CREATE POLICY "Public read product images" ON public.product_images
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Owner or admin manage product images" ON public.product_images;
CREATE POLICY "Owner or admin manage product images" ON public.product_images
  FOR ALL TO authenticated
  USING (private.has_role(ARRAY['OWNER', 'ADMIN']))
  WITH CHECK (private.has_role(ARRAY['OWNER', 'ADMIN']));

-- Create a public catalogue-media bucket with strict image format and size limits.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read product image objects" ON storage.objects;
CREATE POLICY "Public read product image objects" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');
DROP POLICY IF EXISTS "Owner or admin manage product image objects" ON storage.objects;
CREATE POLICY "Owner or admin manage product image objects" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'product-images'
    AND private.has_role(ARRAY['OWNER', 'ADMIN'])
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND private.has_role(ARRAY['OWNER', 'ADMIN'])
  );

-- Preserve public catalogue SELECT access, but remove all browser-side writes
-- and all direct browser access to sensitive operational tables. Server actions
-- use the service role only after a separate authenticated role check.
REVOKE INSERT, UPDATE, DELETE ON public.brands, public.categories, public.products,
  public.settings, public.product_images
  FROM anon, authenticated;
REVOKE ALL ON public.product_variants, public.stock_movements, public.imei_inventory,
  public.customers, public.customer_addresses, public.admin_users, public.orders,
  public.order_items, public.order_status_history, public.invoices, public.invoice_items,
  public.audit_logs
  FROM anon, authenticated;
GRANT SELECT ON public.brands, public.categories, public.products, public.settings,
  public.product_images, public.storefront_variants
  TO anon, authenticated;

-- Tighten existing broad administration policies to role-aware read capabilities.
DROP POLICY IF EXISTS "Admin full access brands" ON public.brands;
DROP POLICY IF EXISTS "Admin full access categories" ON public.categories;
DROP POLICY IF EXISTS "Admin full access products" ON public.products;
DROP POLICY IF EXISTS "Admin full access variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admin full access stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Admin full access imei" ON public.imei_inventory;
DROP POLICY IF EXISTS "Admin full access customers" ON public.customers;
DROP POLICY IF EXISTS "Admin full access customer_addresses" ON public.customer_addresses;
DROP POLICY IF EXISTS "Admin full access admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Admin full access orders" ON public.orders;
DROP POLICY IF EXISTS "Admin full access order_items" ON public.order_items;
DROP POLICY IF EXISTS "Admin full access order_status_history" ON public.order_status_history;
DROP POLICY IF EXISTS "Admin full access invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admin full access invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Admin full access settings" ON public.settings;
DROP POLICY IF EXISTS "Admin full access audit_logs" ON public.audit_logs;

CREATE POLICY "Owner or admin read catalogue operations" ON public.brands
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN']));
CREATE POLICY "Owner or admin write catalogue brands" ON public.brands
  FOR ALL TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN'])) WITH CHECK (private.has_role(ARRAY['OWNER', 'ADMIN']));
CREATE POLICY "Owner or admin read catalogue categories" ON public.categories
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN']));
CREATE POLICY "Owner or admin write catalogue categories" ON public.categories
  FOR ALL TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN'])) WITH CHECK (private.has_role(ARRAY['OWNER', 'ADMIN']));
CREATE POLICY "Owner or admin read catalogue products" ON public.products
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN']));
CREATE POLICY "Owner or admin write catalogue products" ON public.products
  FOR ALL TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN'])) WITH CHECK (private.has_role(ARRAY['OWNER', 'ADMIN']));
CREATE POLICY "Owner or admin read variants" ON public.product_variants
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN']));
CREATE POLICY "Owner or admin write variants" ON public.product_variants
  FOR ALL TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN'])) WITH CHECK (private.has_role(ARRAY['OWNER', 'ADMIN']));
CREATE POLICY "Operational roles read stock ledger" ON public.stock_movements
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN', 'STAFF']));
CREATE POLICY "Owner or admin read IMEI" ON public.imei_inventory
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN']));
CREATE POLICY "Owner or admin write IMEI" ON public.imei_inventory
  FOR ALL TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN'])) WITH CHECK (private.has_role(ARRAY['OWNER', 'ADMIN']));
CREATE POLICY "Operational roles read customers" ON public.customers
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN', 'STAFF']));
CREATE POLICY "Operational roles read customer addresses" ON public.customer_addresses
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN', 'STAFF']));
CREATE POLICY "Operational roles read orders" ON public.orders
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN', 'STAFF']));
CREATE POLICY "Operational roles read order items" ON public.order_items
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN', 'STAFF']));
CREATE POLICY "Operational roles read order history" ON public.order_status_history
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN', 'STAFF']));
CREATE POLICY "Owner or admin read invoices" ON public.invoices
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN']));
CREATE POLICY "Owner or admin read invoice items" ON public.invoice_items
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN']));
CREATE POLICY "Owner or admin read settings" ON public.settings
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER', 'ADMIN']));
CREATE POLICY "Owner reads admin users" ON public.admin_users
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER']));
CREATE POLICY "Owner writes admin users" ON public.admin_users
  FOR ALL TO authenticated USING (private.has_role(ARRAY['OWNER'])) WITH CHECK (private.has_role(ARRAY['OWNER']));
CREATE POLICY "Owner reads audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (private.has_role(ARRAY['OWNER']));

-- Transactional stock movement: caller provides a signed change, while the
-- database validates the movement semantics, authorisation, and final balance.
CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_variant_id uuid,
  p_change_amount integer,
  p_movement_type text,
  p_notes text,
  p_actor_id uuid
)
RETURNS TABLE(new_stock_quantity integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_stock integer;
  v_next_stock integer;
  v_actor_role text;
BEGIN
  SELECT private.admin_role_for(p_actor_id) INTO v_actor_role;
  IF v_actor_role NOT IN ('OWNER', 'ADMIN', 'STAFF') THEN
    RAISE EXCEPTION 'ADMIN_FORBIDDEN';
  END IF;

  IF p_change_amount = 0 OR p_movement_type NOT IN ('RESTOCK', 'SALE', 'RETURN', 'DAMAGE', 'ADJUSTMENT', 'RESERVATION', 'RELEASE') THEN
    RAISE EXCEPTION 'INVALID_STOCK_MOVEMENT';
  END IF;
  IF p_movement_type IN ('RESTOCK', 'RETURN', 'RELEASE') AND p_change_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_STOCK_DIRECTION';
  END IF;
  IF p_movement_type IN ('SALE', 'DAMAGE', 'RESERVATION') AND p_change_amount > 0 THEN
    RAISE EXCEPTION 'INVALID_STOCK_DIRECTION';
  END IF;

  SELECT stock_quantity INTO v_current_stock
  FROM public.product_variants
  WHERE id = p_variant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VARIANT_NOT_FOUND';
  END IF;

  v_next_stock := v_current_stock + p_change_amount;
  IF v_next_stock < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  UPDATE public.product_variants
  SET stock_quantity = v_next_stock, updated_at = now()
  WHERE id = p_variant_id;

  INSERT INTO public.stock_movements (variant_id, change_amount, movement_type, notes, created_by)
  VALUES (p_variant_id, p_change_amount, p_movement_type, nullif(trim(p_notes), ''), p_actor_id);

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    p_actor_id,
    'INVENTORY_ADJUSTED',
    'product_variant',
    p_variant_id,
    jsonb_build_object('movement_type', p_movement_type, 'change_amount', p_change_amount, 'resulting_stock', v_next_stock)
  );

  RETURN QUERY SELECT v_next_stock;
END;
$$;
REVOKE ALL ON FUNCTION public.adjust_inventory(uuid, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_inventory(uuid, integer, text, text, uuid) TO service_role;

-- Transactional order lifecycle update. Historical pricing and item snapshots
-- remain immutable; only the operational status is updated.
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

  SELECT order_status INTO v_previous_status
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF v_previous_status = p_new_status THEN
    RAISE EXCEPTION 'ORDER_STATUS_UNCHANGED';
  END IF;

  UPDATE public.orders
  SET order_status = p_new_status, updated_at = now()
  WHERE id = p_order_id;

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

-- Administrative settings are inserted only when absent; existing live values
-- are never overwritten by this migration.
INSERT INTO public.settings (key, value, description)
VALUES
  (
    'store_profile',
    '{"business_name":"SahiGadget Mobile Phone & Gadget Shop","established":2019,"tagline":"সঠিক দাম, সঠিক গ্যাজেট","brand_promise":"আসল পণ্য • দ্রুত ডেলিভারি • সারা দেশে সেবা","location":"Araihazar, Narayanganj, Bangladesh – 1460","phone":"+880 1601-654316","public_email":"www.sahigadget.com@gmail.com","admin_email":"helpline.sahitech@gmail.com","currency":"BDT","languages":["Bangla","English"]}'::jsonb,
    'Central store profile for administration and storefront presentation'
  ),
  (
    'return_refund_policy',
    '{"policy_text":"7-day guarantee for qualifying manufacturing or product issues. Repair or replacement is preferred where applicable. Refund may be used where repair or replacement is not possible or appropriate. A valid invoice or order identification is required. IMEI or serial verification applies where relevant. Customer-caused physical or liquid damage, unauthorized repair or modification, and normal wear and tear are excluded. Manufacturer warranty and service terms apply where applicable."}'::jsonb,
    'Configurable return and refund policy'
  )
ON CONFLICT (key) DO NOTHING;

-- Future public-schema functions must stay opt-in for browser roles.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
