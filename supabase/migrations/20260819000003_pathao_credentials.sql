-- Pathao Phase 1 credential/token persistence.
-- Secrets are encrypted by the application before insertion; this table never stores
-- client secret, username, or password. The encryption key remains server-only.

CREATE TABLE IF NOT EXISTS public.delivery_provider_credentials (
  provider TEXT PRIMARY KEY REFERENCES public.delivery_providers(provider) ON DELETE CASCADE,
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  token_type TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_successful_auth_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.delivery_provider_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access delivery_provider_credentials" ON public.delivery_provider_credentials;
CREATE POLICY "Admin full access delivery_provider_credentials"
  ON public.delivery_provider_credentials
  FOR ALL
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

REVOKE ALL ON TABLE public.delivery_provider_credentials FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_provider_credentials TO service_role;

CREATE INDEX IF NOT EXISTS delivery_provider_credentials_auth_expiry_idx
  ON public.delivery_provider_credentials(provider, access_token_expires_at);
