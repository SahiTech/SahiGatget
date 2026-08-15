-- Brand logos are distinct public brand assets, not product photography or homepage banners.
-- Reuse brands.logo_url; this migration adds only the dedicated storage bucket and policies.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-logos',
  'brand-logos',
  true,
  2097152,
  ARRAY['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read brand logo objects" ON storage.objects;
CREATE POLICY "Public read brand logo objects" ON storage.objects
  FOR SELECT USING (bucket_id = 'brand-logos');

DROP POLICY IF EXISTS "Owner or admin manage brand logo objects" ON storage.objects;
CREATE POLICY "Owner or admin manage brand logo objects" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'brand-logos'
    AND private.has_role(ARRAY['OWNER', 'ADMIN'])
  )
  WITH CHECK (
    bucket_id = 'brand-logos'
    AND private.has_role(ARRAY['OWNER', 'ADMIN'])
  );
