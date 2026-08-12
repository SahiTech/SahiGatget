-- Phase 3 audit hardening: make browser-facing database access explicit and least-privilege.

-- Internal operational and customer-data tables are server/admin-only.
REVOKE ALL ON TABLE public.admin_users, public.audit_logs, public.customers, public.customer_addresses,
  public.orders, public.order_items, public.order_status_history, public.invoices, public.invoice_items,
  public.imei_inventory, public.stock_movements
  FROM anon, authenticated;

-- Authenticated administrators retain access subject to private.is_admin() RLS policies.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_users, public.audit_logs, public.customers, public.customer_addresses,
  public.orders, public.order_items, public.order_status_history, public.invoices, public.invoice_items,
  public.imei_inventory, public.stock_movements
  TO authenticated;

-- Public catalogue tables are read-only for browser clients; authenticated admins retain writes through RLS.
REVOKE ALL ON TABLE public.brands, public.categories, public.products, public.product_variants, public.settings
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.brands, public.categories, public.products, public.settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.brands, public.categories, public.products, public.product_variants, public.settings TO authenticated;

-- The public view is the sole browser surface for variant pricing and availability.
REVOKE ALL ON TABLE public.storefront_variants FROM anon, authenticated;
GRANT SELECT ON TABLE public.storefront_variants TO anon, authenticated;
