-- Provider-specific credential storage for Steadfast. Sensitive values are encrypted server-side.
ALTER TABLE public.delivery_provider_credentials
  DROP CONSTRAINT IF EXISTS delivery_provider_credentials_base_url_check;

ALTER TABLE public.delivery_provider_credentials
  ADD CONSTRAINT delivery_provider_credentials_base_url_check
  CHECK (
    (provider = 'PATHAO' AND base_url = 'https://api-hermes.pathao.com') OR
    (provider = 'STEADFAST' AND base_url = 'https://portal.packzy.com/api/v1') OR
    (provider NOT IN ('PATHAO', 'STEADFAST') AND base_url IS NOT NULL)
  );

ALTER TABLE public.delivery_provider_credentials
  ADD COLUMN IF NOT EXISTS encrypted_api_key TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_secret_key TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_webhook_token TEXT;

INSERT INTO public.delivery_provider_credentials (provider, environment, base_url)
VALUES ('STEADFAST', 'PRODUCTION', 'https://portal.packzy.com/api/v1')
ON CONFLICT (provider) DO NOTHING;

CREATE INDEX IF NOT EXISTS delivery_provider_credentials_provider_idx ON public.delivery_provider_credentials(provider);
