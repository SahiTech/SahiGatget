-- Provider-specific production credential seed for REDX.
-- Sensitive values are stored encrypted by the application layer; no credentials are hard-coded here.

INSERT INTO public.delivery_provider_credentials (provider, environment, base_url)
VALUES ('REDX', 'PRODUCTION', 'https://openapi.redx.com.bd/v1.0.0-beta')
ON CONFLICT (provider) DO UPDATE
SET environment = EXCLUDED.environment,
    base_url = EXCLUDED.base_url,
    updated_at = NOW();

CREATE INDEX IF NOT EXISTS delivery_provider_credentials_redx_idx
  ON public.delivery_provider_credentials(provider);
