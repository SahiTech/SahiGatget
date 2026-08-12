-- Resolve the security-definer-view advisory without reopening base variant data.
-- The public view runs as the caller; its non-exposed private function returns only safe fields.

CREATE OR REPLACE FUNCTION private.get_storefront_variants()
RETURNS TABLE (
  id UUID,
  product_id UUID,
  sku VARCHAR,
  variant_title VARCHAR,
  ram VARCHAR,
  storage VARCHAR,
  color VARCHAR,
  price NUMERIC,
  compare_at_price NUMERIC,
  is_in_stock BOOLEAN,
  is_low_stock BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

REVOKE ALL ON FUNCTION private.get_storefront_variants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_storefront_variants() TO anon, authenticated;

DROP VIEW IF EXISTS public.storefront_variants;
CREATE VIEW public.storefront_variants
WITH (security_invoker = true)
AS
SELECT * FROM private.get_storefront_variants();

REVOKE ALL ON TABLE public.storefront_variants FROM anon, authenticated;
GRANT SELECT ON TABLE public.storefront_variants TO anon, authenticated;
