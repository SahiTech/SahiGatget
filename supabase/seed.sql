-- Disposable CI/local fixtures only. Never use Production customer data here.
INSERT INTO public.brands (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000101', 'CI Test Brand', 'ci-test-brand')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.categories (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000102', 'CI Test Category', 'ci-test-category')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (
  id, brand_id, category_id, name, slug, product_type, status, is_published, warranty_policy
)
VALUES (
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102',
  'CI Test Phone',
  'ci-test-phone',
  'phone',
  'active',
  TRUE,
  'CI test warranty'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_variants (
  id, product_id, sku, variant_title, price, compare_at_price, stock_quantity, is_active
)
VALUES (
  '00000000-0000-0000-0000-000000000104',
  '00000000-0000-0000-0000-000000000103',
  'CI-TEST-001',
  'CI Test Variant',
  1500,
  1700,
  20,
  TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.settings (key, value, description)
VALUES
  ('payment_policy', '{"codEnabled":true,"bdgateEnabled":true,"defaultProvider":"BDGATE","paymentExpiryMinutes":30}'::jsonb, 'CI-only payment routing fixture')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
