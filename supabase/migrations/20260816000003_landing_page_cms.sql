-- Structured Landing Page Builder CMS
-- Additive only: does not alter commerce, auth, order, inventory, or existing CMS tables.

CREATE TABLE IF NOT EXISTS public.landing_pages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text NOT NULL UNIQUE,
  internal_name text NOT NULL,
  page_type text NOT NULL DEFAULT 'product' CHECK (page_type IN ('product', 'campaign')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  linked_product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
  hero_image_url text,
  mobile_hero_image_url text,
  og_image_url text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo_title text,
  seo_description text,
  noindex boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT landing_pages_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT landing_pages_product_requirement CHECK (page_type = 'campaign' OR linked_product_id IS NOT NULL),
  CONSTRAINT landing_pages_schedule_valid CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.landing_page_products (
  landing_page_id uuid NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (landing_page_id, product_id)
);

CREATE INDEX IF NOT EXISTS landing_pages_publicity_idx ON public.landing_pages(status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS landing_page_products_order_idx ON public.landing_page_products(landing_page_id, sort_order);

ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published landing pages" ON public.landing_pages;
CREATE POLICY "Public read published landing pages" ON public.landing_pages
  FOR SELECT USING (
    status = 'published'
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );

DROP POLICY IF EXISTS "Owner or admin manage landing pages" ON public.landing_pages;
CREATE POLICY "Owner or admin manage landing pages" ON public.landing_pages
  FOR ALL TO authenticated
  USING (private.has_role(ARRAY['OWNER', 'ADMIN']))
  WITH CHECK (private.has_role(ARRAY['OWNER', 'ADMIN']));

DROP POLICY IF EXISTS "Public read linked landing products" ON public.landing_page_products;
CREATE POLICY "Public read linked landing products" ON public.landing_page_products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.landing_pages page
      WHERE page.id = landing_page_id
        AND page.status = 'published'
        AND (page.starts_at IS NULL OR page.starts_at <= now())
        AND (page.ends_at IS NULL OR page.ends_at > now())
    )
  );

DROP POLICY IF EXISTS "Owner or admin manage linked landing products" ON public.landing_page_products;
CREATE POLICY "Owner or admin manage linked landing products" ON public.landing_page_products
  FOR ALL TO authenticated
  USING (private.has_role(ARRAY['OWNER', 'ADMIN']))
  WITH CHECK (private.has_role(ARRAY['OWNER', 'ADMIN']));

GRANT SELECT ON public.landing_pages, public.landing_page_products TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.landing_pages, public.landing_page_products FROM anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'landing-pages',
  'landing-pages',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read landing page media" ON storage.objects;
CREATE POLICY "Public read landing page media" ON storage.objects
  FOR SELECT USING (bucket_id = 'landing-pages');

DROP POLICY IF EXISTS "Owner or admin manage landing page media" ON storage.objects;
CREATE POLICY "Owner or admin manage landing page media" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'landing-pages' AND private.has_role(ARRAY['OWNER', 'ADMIN']))
  WITH CHECK (bucket_id = 'landing-pages' AND private.has_role(ARRAY['OWNER', 'ADMIN']));
