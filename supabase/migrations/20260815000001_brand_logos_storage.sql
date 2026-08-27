-- Brand logos are distinct public brand assets, not product photography or homepage banners.
-- Reuse brands.logo_url; this migration adds only the dedicated storage bucket and policies.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'buckets'
      AND column_name IN ('public', 'file_size_limit', 'allowed_mime_types')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 3
  ) THEN
    EXECUTE $sql$
      INSERT INTO storage.buckets (id, name, "public", file_size_limit, allowed_mime_types)
      VALUES ('brand-logos', 'brand-logos', true, 2097152, ARRAY['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg'])
      ON CONFLICT (id) DO UPDATE
      SET "public" = EXCLUDED."public",
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types
    $sql$;
  ELSE
    RAISE NOTICE 'Skipping managed Storage bucket metadata upsert for brand-logos';
  END IF;
END
$$;

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
