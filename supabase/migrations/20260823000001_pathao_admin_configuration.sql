-- Admin-managed Pathao Production configuration.
-- Client secret and password are encrypted by the server before insertion.
-- The encryption key remains server-only; no plaintext secret is stored here.

ALTER TABLE public.delivery_provider_credentials
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'PRODUCTION',
  ADD COLUMN IF NOT EXISTS base_url TEXT NOT NULL DEFAULT 'https://api-hermes.pathao.com',
  ADD COLUMN IF NOT EXISTS client_id TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_client_secret TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_password TEXT;

ALTER TABLE public.delivery_provider_credentials
  DROP CONSTRAINT IF EXISTS delivery_provider_credentials_environment_check;

ALTER TABLE public.delivery_provider_credentials
  ADD CONSTRAINT delivery_provider_credentials_environment_check
  CHECK (environment = 'PRODUCTION');

ALTER TABLE public.delivery_provider_credentials
  DROP CONSTRAINT IF EXISTS delivery_provider_credentials_base_url_check;

ALTER TABLE public.delivery_provider_credentials
  ADD CONSTRAINT delivery_provider_credentials_base_url_check
  CHECK (base_url = 'https://api-hermes.pathao.com');
