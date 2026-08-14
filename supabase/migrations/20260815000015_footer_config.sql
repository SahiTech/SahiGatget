-- SahiGadget footer configuration: social destinations and truthful payment display.
-- This extends the existing settings JSON model; it does not alter commerce tables.
INSERT INTO public.settings (key, value, description)
VALUES (
  'footer_config',
  '{"social":{"facebook":"https://www.facebook.com/sahigadgetbd","tiktok":"","instagram":"","x":"","youtube":""},"payments":{"cash_on_delivery":true,"visa":false,"mastercard":false}}'::jsonb,
  'Public footer social destinations and active payment-method display configuration'
)
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Allow public read storefront settings" ON public.settings;
CREATE POLICY "Allow public read storefront settings" ON public.settings
  FOR SELECT
  USING (key IN ('delivery_charges', 'business_policy', 'footer_config'));

COMMENT ON COLUMN public.settings.value IS 'JSON configuration. footer_config contains only validated public social URLs and truthful payment display flags.';
