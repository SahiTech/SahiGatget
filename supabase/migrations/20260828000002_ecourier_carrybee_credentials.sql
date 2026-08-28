-- Provider-specific credential storage for eCourier and CarryBee.
-- Secrets are encrypted by the application before persistence.
ALTER TABLE public.delivery_provider_credentials
  ADD COLUMN IF NOT EXISTS encrypted_user_id TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_client_id TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_client_secret TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_client_context TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_webhook_token TEXT,
  ADD COLUMN IF NOT EXISTS pickup_store_id TEXT;

INSERT INTO public.delivery_provider_credentials (provider, environment, base_url)
VALUES
  ('ECOURIER', 'PRODUCTION', 'https://backoffice.ecourier.com.bd/api'),
  ('CARRYBEE', 'PRODUCTION', 'https://carrybee.com')
ON CONFLICT (provider) DO NOTHING;
