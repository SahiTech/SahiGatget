-- Customer Risk & Order Decision Engine
-- Reuses settings, orders, commerce_events, risk_assessments, and audit_logs.
INSERT INTO public.settings (key, value, description)
VALUES (
  'risk_policy',
  '{"enabled":true,"weights":{"cancelledOneToTwo":15,"cancelledThreePlus":35,"returnedOrders":25,"paymentFailures":15,"rapidAttempts":20,"recentCancellation":10,"successfulDelivery":15},"thresholds":{"verification":25,"review":50,"block":75}}'::jsonb,
  'Deterministic customer risk weights and COD decision thresholds'
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.risk_assessments IS 'Server-side deterministic customer risk assessments. phone_hash is non-reversible and reasons contain no customer identity data.';
