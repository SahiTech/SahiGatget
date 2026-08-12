-- Phase 3 final audit remediation: harden public data access before Phase 4.
-- This migration intentionally targets only the isolated SahiGatget Supabase project.

-- Keep the RBAC helper out of the exposed API schema, pin its search path,
-- and prohibit direct execution by browser roles.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND is_active = TRUE
  ) OR (auth.role() = 'service_role');
$$;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;

-- Rebind all existing administration policies to the private helper.
DROP POLICY IF EXISTS "Admin full access brands" ON public.brands;
CREATE POLICY "Admin full access brands" ON public.brands FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access categories" ON public.categories;
CREATE POLICY "Admin full access categories" ON public.categories FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access products" ON public.products;
CREATE POLICY "Admin full access products" ON public.products FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access variants" ON public.product_variants;
CREATE POLICY "Admin full access variants" ON public.product_variants FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access stock_movements" ON public.stock_movements;
CREATE POLICY "Admin full access stock_movements" ON public.stock_movements FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access imei" ON public.imei_inventory;
CREATE POLICY "Admin full access imei" ON public.imei_inventory FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access customers" ON public.customers;
CREATE POLICY "Admin full access customers" ON public.customers FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access customer_addresses" ON public.customer_addresses;
CREATE POLICY "Admin full access customer_addresses" ON public.customer_addresses FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access admin_users" ON public.admin_users;
CREATE POLICY "Admin full access admin_users" ON public.admin_users FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access orders" ON public.orders;
CREATE POLICY "Admin full access orders" ON public.orders FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access order_items" ON public.order_items;
CREATE POLICY "Admin full access order_items" ON public.order_items FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access order_status_history" ON public.order_status_history;
CREATE POLICY "Admin full access order_status_history" ON public.order_status_history FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access invoices" ON public.invoices;
CREATE POLICY "Admin full access invoices" ON public.invoices FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access invoice_items" ON public.invoice_items;
CREATE POLICY "Admin full access invoice_items" ON public.invoice_items FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access settings" ON public.settings;
CREATE POLICY "Admin full access settings" ON public.settings FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admin full access audit_logs" ON public.audit_logs;
CREATE POLICY "Admin full access audit_logs" ON public.audit_logs FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

DROP FUNCTION IF EXISTS public.is_admin();

-- Orders, customers, IMEI, invoices, and internal history must never be readable
-- directly by anonymous or ordinary authenticated browser clients.
DROP POLICY IF EXISTS "Allow read order by tracking token" ON public.orders;

-- Expose only the customer-safe public variant fields. Exact stock counts and
-- low-stock thresholds remain available only to server/admin code.
DROP POLICY IF EXISTS "Allow public read active variants" ON public.product_variants;
REVOKE SELECT ON public.product_variants FROM anon, authenticated;

CREATE OR REPLACE VIEW public.storefront_variants AS
SELECT
  variant.id,
  variant.product_id,
  variant.sku,
  variant.variant_title,
  variant.ram,
  variant.storage,
  variant.color,
  variant.price,
  variant.compare_at_price,
  (variant.stock_quantity > 0) AS is_in_stock,
  (variant.stock_quantity > 0 AND variant.stock_quantity <= variant.low_stock_threshold) AS is_low_stock
FROM public.product_variants AS variant
INNER JOIN public.products AS product ON product.id = variant.product_id
WHERE variant.is_active = TRUE
  AND product.is_published = TRUE;

REVOKE ALL ON public.storefront_variants FROM PUBLIC;
GRANT SELECT ON public.storefront_variants TO anon, authenticated;

-- Only the settings that Phase 3 intentionally presents to customers are public.
DROP POLICY IF EXISTS "Allow public read settings" ON public.settings;
CREATE POLICY "Allow public read storefront settings" ON public.settings
  FOR SELECT
  USING (key IN ('delivery_charges', 'business_policy'));

-- Make future public-schema functions opt-in for API roles.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
