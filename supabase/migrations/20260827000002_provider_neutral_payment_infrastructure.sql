-- Provider-neutral payment infrastructure.
-- Current checkout remains COD; this migration only adds future-ready payment state.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_requirement TEXT NOT NULL DEFAULT 'COD'
  CHECK (payment_requirement IN ('COD', 'FULL_ADVANCE', 'PARTIAL_ADVANCE', 'MANUAL_REVIEW'));

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('COD', 'BKASH', 'NAGAD', 'ROCKET')),
  provider_payment_id TEXT,
  provider_transaction_id TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'BDT' CHECK (currency = 'BDT'),
  status TEXT NOT NULL CHECK (status IN ('NOT_REQUIRED', 'PENDING', 'INITIATED', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
  payment_requirement TEXT NOT NULL CHECK (payment_requirement IN ('COD', 'FULL_ADVANCE', 'PARTIAL_ADVANCE', 'MANUAL_REVIEW')),
  idempotency_key TEXT NOT NULL UNIQUE,
  payment_url TEXT,
  failure_category TEXT CHECK (failure_category IS NULL OR failure_category IN ('PAYMENT_DECLINED', 'PAYMENT_TIMEOUT', 'PAYMENT_CANCELLED', 'PAYMENT_VERIFICATION_FAILED', 'PAYMENT_PROVIDER_UNAVAILABLE', 'PAYMENT_AMOUNT_MISMATCH', 'PAYMENT_EXPIRED', 'UNKNOWN_PAYMENT_ERROR')),
  failure_message TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_payment_idx
  ON public.payment_transactions(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_transactions_order_idx
  ON public.payment_transactions(order_id, created_at DESC);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access payment_transactions" ON public.payment_transactions;
CREATE POLICY "Admin full access payment_transactions" ON public.payment_transactions FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());
REVOKE ALL ON TABLE public.payment_transactions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_transactions TO service_role;
