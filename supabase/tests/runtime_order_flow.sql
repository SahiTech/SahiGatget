-- Database-backed disposable order-flow assertions.
-- Runs only against the local/CI Supabase database.

DO $$
DECLARE
  v_first RECORD;
  v_second RECORD;
  v_stock INTEGER;
  v_paid_order UUID;
  v_failed_order UUID;
BEGIN
  SELECT * INTO v_first
  FROM public.create_guest_cod_order(
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000104',
    1,
    '00000000-0000-0000-0000-000000001001',
    'CI COD Customer',
    '01700000001',
    'ci@example.test',
    'Dhaka',
    'Dhaka',
    'Mohammadpur',
    'CI address',
    '1207',
    'CI COD test'
  );

  IF v_first.created_new IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'COD first submission did not create a new order';
  END IF;

  SELECT stock_quantity INTO v_stock
  FROM public.product_variants
  WHERE id = '00000000-0000-0000-0000-000000000104';
  IF v_stock <> 19 THEN
    RAISE EXCEPTION 'COD stock mutation expected 19, got %', v_stock;
  END IF;

  SELECT * INTO v_second
  FROM public.create_guest_cod_order(
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000104',
    1,
    '00000000-0000-0000-0000-000000001001',
    'CI COD Customer',
    '01700000001',
    'ci@example.test',
    'Dhaka',
    'Dhaka',
    'Mohammadpur',
    'CI address',
    '1207',
    'duplicate'
  );

  IF v_second.created_new IS DISTINCT FROM FALSE OR v_second.order_id <> v_first.order_id THEN
    RAISE EXCEPTION 'COD idempotency failed';
  END IF;

  INSERT INTO public.checkout_sessions (
    checkout_request_id, source, status, customer_phone, customer_email,
    quote_snapshot
  ) VALUES (
    '00000000-0000-0000-0000-000000001002', 'QUICK_ORDER', 'DETAILS_ENTERED',
    '01700000002', 'draft@example.test', '{"product_id":"00000000-0000-0000-0000-000000000103"}'::jsonb
  );

  UPDATE public.checkout_sessions
  SET status = 'ABANDONED', last_activity_at = NOW()
  WHERE checkout_request_id = '00000000-0000-0000-0000-000000001002';

  IF NOT EXISTS (
    SELECT 1 FROM public.checkout_sessions
    WHERE checkout_request_id = '00000000-0000-0000-0000-000000001002'
      AND status = 'ABANDONED'
  ) THEN
    RAISE EXCEPTION 'Incomplete checkout lifecycle failed';
  END IF;

  SELECT * INTO v_first
  FROM public.create_guest_advance_order(
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000104',
    1,
    '00000000-0000-0000-0000-000000001003',
    'CI Advance Paid',
    '01700000003',
    'advance-paid@example.test',
    'Dhaka',
    'Dhaka',
    'Dhanmondi',
    'Advance paid address',
    '1209',
    'CI advance paid test'
  );
  v_paid_order := v_first.order_id;

  SELECT stock_quantity INTO v_stock
  FROM public.product_variants
  WHERE id = '00000000-0000-0000-0000-000000000104';
  IF v_stock <> 18 THEN
    RAISE EXCEPTION 'Advance reservation did not reduce available stock to 18; got %', v_stock;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stock_movements
    WHERE reference_id = v_paid_order AND movement_type = 'RESERVATION'
  ) THEN
    RAISE EXCEPTION 'Advance reservation ledger entry missing';
  END IF;

  INSERT INTO public.payment_transactions (
    order_id, provider, provider_payment_id, amount, currency,
    status, payment_requirement, idempotency_key
  ) VALUES (
    v_paid_order, 'BDGATE', 'CI-PAY-PAID-001', 1580, 'BDT',
    'INITIATED', 'FULL_ADVANCE', 'ci:paid:001'
  );

  UPDATE public.payment_transactions
  SET status = 'PAID', provider_transaction_id = 'CI-TX-PAID-001', paid_at = NOW()
  WHERE idempotency_key = 'ci:paid:001';

  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = v_paid_order AND payment_status = 'paid' AND order_status = 'CONFIRMED'
  ) THEN
    RAISE EXCEPTION 'Advance payment success did not finalize order';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stock_movements
    WHERE reference_id = v_paid_order AND movement_type = 'SALE'
  ) THEN
    RAISE EXCEPTION 'Advance payment success did not commit reservation to sale';
  END IF;

  SELECT * INTO v_second
  FROM public.create_guest_advance_order(
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000104',
    1,
    '00000000-0000-0000-0000-000000001004',
    'CI Advance Failed',
    '01700000004',
    'advance-failed@example.test',
    'Dhaka',
    'Dhaka',
    'Uttara',
    'Advance failed address',
    '1230',
    'CI advance failed test'
  );
  v_failed_order := v_second.order_id;

  SELECT stock_quantity INTO v_stock
  FROM public.product_variants
  WHERE id = '00000000-0000-0000-0000-000000000104';
  IF v_stock <> 17 THEN
    RAISE EXCEPTION 'Second advance reservation expected stock 17, got %', v_stock;
  END IF;

  INSERT INTO public.payment_transactions (
    order_id, provider, provider_payment_id, amount, currency,
    status, payment_requirement, idempotency_key
  ) VALUES (
    v_failed_order, 'BDGATE', 'CI-PAY-FAILED-001', 1580, 'BDT',
    'INITIATED', 'FULL_ADVANCE', 'ci:failed:001'
  );

  UPDATE public.payment_transactions
  SET status = 'FAILED', failure_category = 'PAYMENT_DECLINED'
  WHERE idempotency_key = 'ci:failed:001';

  SELECT stock_quantity INTO v_stock
  FROM public.product_variants
  WHERE id = '00000000-0000-0000-0000-000000000104';
  IF v_stock <> 18 THEN
    RAISE EXCEPTION 'Failed advance payment did not release stock; got %', v_stock;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = v_failed_order AND payment_status = 'failed' AND order_status = 'CANCELLED'
  ) THEN
    RAISE EXCEPTION 'Failed advance payment did not safely cancel order';
  END IF;

  RAISE NOTICE 'SAHIGADGET DATABASE ORDER FLOW: PASS';
END;
$$;
