-- Phase B: Admin-managed AI provider configuration.
-- Secrets are encrypted by the server before storage and never exposed to browser roles.

CREATE TABLE IF NOT EXISTS public.assistant_provider_configurations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider text NOT NULL CHECK (provider IN ('OPENAI_COMPATIBLE', 'OPENAI', 'GEMINI')),
  api_url text NOT NULL CHECK (api_url LIKE 'https://%'),
  encrypted_api_key text NOT NULL,
  model text NOT NULL CHECK (char_length(model) BETWEEN 1 AND 200),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assistant_provider_configurations_singleton
  ON public.assistant_provider_configurations ((true));
CREATE INDEX IF NOT EXISTS idx_assistant_provider_configurations_updated_at
  ON public.assistant_provider_configurations (updated_at DESC);

ALTER TABLE public.assistant_provider_configurations ENABLE ROW LEVEL SECURITY;

-- The server-only service-role client is the sole application access path.
-- No anon/authenticated grants or SELECT policies are created for encrypted data.
REVOKE ALL ON public.assistant_provider_configurations FROM anon, authenticated;
GRANT ALL ON public.assistant_provider_configurations TO service_role;
