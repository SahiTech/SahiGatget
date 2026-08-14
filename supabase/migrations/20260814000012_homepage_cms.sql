-- ============================================================================
-- Phase 18.1: Homepage Content Management System (CMS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.homepage_banners (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  desktop_image_url text NOT NULL,
  mobile_image_url text NOT NULL,
  heading text NOT NULL,
  description text NOT NULL,
  primary_cta_text text NOT NULL,
  primary_cta_url text NOT NULL,
  secondary_cta_text text,
  secondary_cta_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.homepage_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active banners" ON public.homepage_banners;
CREATE POLICY "Public read active banners" ON public.homepage_banners
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Owner or admin manage banners" ON public.homepage_banners;
CREATE POLICY "Owner or admin manage banners" ON public.homepage_banners
  FOR ALL TO authenticated
  USING (private.has_role(ARRAY['OWNER', 'ADMIN']))
  WITH CHECK (private.has_role(ARRAY['OWNER', 'ADMIN']));

-- Storage Bucket for Homepage Banners
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'homepage-banners',
  'homepage-banners',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read banner objects" ON storage.objects;
CREATE POLICY "Public read banner objects" ON storage.objects
  FOR SELECT USING (bucket_id = 'homepage-banners');

DROP POLICY IF EXISTS "Owner or admin manage banner objects" ON storage.objects;
CREATE POLICY "Owner or admin manage banner objects" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'homepage-banners'
    AND private.has_role(ARRAY['OWNER', 'ADMIN'])
  )
  WITH CHECK (
    bucket_id = 'homepage-banners'
    AND private.has_role(ARRAY['OWNER', 'ADMIN'])
  );

-- Grants
GRANT SELECT ON public.homepage_banners TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.homepage_banners FROM anon, authenticated;
