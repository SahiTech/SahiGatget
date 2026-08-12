-- Preserve authenticated administrator access to base variant records.
-- Anonymous public access remains limited to public.storefront_variants.
GRANT SELECT ON public.product_variants TO authenticated;
