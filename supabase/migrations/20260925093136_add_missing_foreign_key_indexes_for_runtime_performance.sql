-- Cover foreign-key columns used by joins and parent-row updates/deletes.
-- Intentionally additive: no existing indexes are removed in this migration.
create index if not exists cart_items_product_id_idx on public.cart_items(product_id);
create index if not exists cart_items_variant_id_idx on public.cart_items(variant_id);
create index if not exists checkout_sessions_completed_order_id_idx on public.checkout_sessions(completed_order_id);
create index if not exists commerce_events_cart_id_idx on public.commerce_events(cart_id);
create index if not exists customer_addresses_customer_id_idx on public.customer_addresses(customer_id);
create index if not exists customer_support_requests_resolved_by_idx on public.customer_support_requests(resolved_by);
create index if not exists delivery_audit_logs_provider_idx on public.delivery_audit_logs(provider);
create index if not exists homepage_banners_created_by_idx on public.homepage_banners(created_by);
create index if not exists imei_inventory_order_id_idx on public.imei_inventory(order_id);
create index if not exists inventory_receipts_created_by_idx on public.inventory_receipts(created_by);
create index if not exists landing_page_products_product_id_idx on public.landing_page_products(product_id);
create index if not exists landing_pages_created_by_idx on public.landing_pages(created_by);
create index if not exists landing_pages_linked_product_id_idx on public.landing_pages(linked_product_id);
create index if not exists landing_pages_updated_by_idx on public.landing_pages(updated_by);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists order_items_variant_id_idx on public.order_items(variant_id);
create index if not exists product_images_product_variant_idx on public.product_images(product_id, variant_id);
