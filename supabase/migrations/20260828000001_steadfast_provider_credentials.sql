-- Steadfast uses API-Key + Secret-Key authentication and an optional webhook bearer token.
-- All sensitive values are encrypted server-side before persistence.
ALTER TABLE public.delivery_provider_credentials
  ADD COLUMN IF NOT EXISTS encrypted_api_key TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_secret_key TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_webhook_token TEXT;

INSERT INTO public.delivery_provider_credentials (provider, environment, base_url)
VALUES ('STEADFAST', 'PRODUCTION', 'https://portal.packzy.com/api/v1')
ON CONFLICT (provider) DO NOTHING;

CREATE INDEX IF NOT EXISTS delivery_provider_credentials_provider_idx ON public.delivery_provider_credentials(provider);
