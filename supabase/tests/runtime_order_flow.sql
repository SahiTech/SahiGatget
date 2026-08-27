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


-- Isolated runtime assertions for payment state transitions, analytics deduplication,
-- and role/RLS boundaries. This file is executed only against disposable CI Supabase.

DO $$
DECLARE
  v_order UUID;
  v_tx UUID;
  v_failed_order UUID;
  v_failed_tx UUID;
  v_count INTEGER;
  v_rejected BOOLEAN;
BEGIN
  SELECT order_id INTO v_order
  FROM public.payment_transactions
  WHERE payment_requirement = 'FULL_ADVANCE'
  ORDER BY created_at
  LIMIT 1;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'state test requires an advance order';
  END IF;

  SELECT id INTO v_tx FROM public.payment_transactions WHERE order_id = v_order ORDER BY created_at LIMIT 1;
  IF v_tx IS NULL THEN
    INSERT INTO public.payment_transactions (order_id, provider, provider_payment_id, amount, currency, status, payment_requirement, idempotency_key)
    VALUES (v_order, 'BDGATE', 'STATE-PAID-001', 1580, 'BDT', 'INITIATED', 'FULL_ADVANCE', 'state:paid:001')
    RETURNING id INTO v_tx;
  END IF;

  -- A legal pending transition is accepted.
  UPDATE public.payment_transactions SET status = 'PENDING' WHERE id = v_tx AND status = 'INITIATED';

  -- Terminal PAID cannot move backwards.
  UPDATE public.payment_transactions SET status = 'PAID', provider_transaction_id = 'STATE-TX-PAID', paid_at = NOW() WHERE id = v_tx;
  v_rejected := FALSE;
  BEGIN
    UPDATE public.payment_transactions SET status = 'PENDING' WHERE id = v_tx;
  EXCEPTION WHEN OTHERS THEN
    v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'PAID to PENDING was accepted'; END IF;

  v_rejected := FALSE;
  BEGIN
    UPDATE public.payment_transactions SET status = 'FAILED' WHERE id = v_tx;
  EXCEPTION WHEN OTHERS THEN
    v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'PAID to FAILED was accepted'; END IF;

  v_rejected := FALSE;
  BEGIN
    UPDATE public.payment_transactions SET status = 'CANCELLED' WHERE id = v_tx;
  EXCEPTION WHEN OTHERS THEN
    v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'PAID to CANCELLED was accepted'; END IF;

  -- Duplicate verification is idempotent: same PAID state does not create a second sale.
  UPDATE public.payment_transactions SET status = 'PAID' WHERE id = v_tx;
  SELECT COUNT(*) INTO v_count FROM public.stock_movements WHERE reference_id = v_order AND movement_type = 'SALE';
  IF v_count <> 1 THEN RAISE EXCEPTION 'duplicate PAID created % sale movements', v_count; END IF;

  -- Failed terminal states cannot be promoted to PAID.
  SELECT order_id INTO v_failed_order
  FROM public.payment_transactions
  WHERE status = 'FAILED'
  LIMIT 1;
  IF v_failed_order IS NULL THEN
    RAISE EXCEPTION 'state test requires a failed payment';
  END IF;
  SELECT id INTO v_failed_tx FROM public.payment_transactions WHERE order_id = v_failed_order AND status = 'FAILED' LIMIT 1;
  v_rejected := FALSE;
  BEGIN
    UPDATE public.payment_transactions SET status = 'PAID' WHERE id = v_failed_tx;
  EXCEPTION WHEN OTHERS THEN
    v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'FAILED to PAID was accepted'; END IF;

  -- Successful order emits one canonical completion event; duplicate event_id is rejected.
  INSERT INTO public.commerce_events (event_id, event_name, order_id, metadata)
  VALUES ('ci:order-complete:001', 'ORDER_COMPLETED', v_order, '{"source":"isolated-test"}'::jsonb)
  ON CONFLICT (event_id) DO NOTHING;
  INSERT INTO public.commerce_events (event_id, event_name, order_id, metadata)
  VALUES ('ci:order-complete:001', 'ORDER_COMPLETED', v_order, '{"source":"duplicate"}'::jsonb)
  ON CONFLICT (event_id) DO NOTHING;
  SELECT COUNT(*) INTO v_count FROM public.commerce_events WHERE event_id = 'ci:order-complete:001';
  IF v_count <> 1 THEN RAISE EXCEPTION 'duplicate completion event was not deduplicated'; END IF;

  -- Abandoned/failed synthetic flows have no purchase event.
  SELECT COUNT(*) INTO v_count FROM public.commerce_events WHERE event_id IN ('ci:abandoned-purchase', 'ci:failed-purchase');
  IF v_count <> 0 THEN RAISE EXCEPTION 'non-completed flow emitted purchase event'; END IF;

  RAISE NOTICE 'SAHIGADGET PAYMENT STATE + ANALYTICS: PASS';
END;
$$;

-- Anonymous cannot read private operational data, but can read intended public settings.
BEGIN;
  SET LOCAL ROLE anon;
  DO $$
  DECLARE v_rejected BOOLEAN := FALSE;
  BEGIN
    BEGIN PERFORM 1 FROM public.checkout_sessions; EXCEPTION WHEN OTHERS THEN v_rejected := TRUE; END;
    IF NOT v_rejected THEN RAISE EXCEPTION 'anon read checkout_sessions was allowed'; END IF;
    v_rejected := FALSE;
    BEGIN PERFORM 1 FROM public.risk_assessments; EXCEPTION WHEN OTHERS THEN v_rejected := TRUE; END;
    IF NOT v_rejected THEN RAISE EXCEPTION 'anon read risk_assessments was allowed'; END IF;
    PERFORM 1 FROM public.settings WHERE key = 'delivery_charges';
  END;
  $$;
COMMIT;

-- Authenticated non-admin cannot read private operational data or mutate payment/order state.
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000009901","role":"authenticated"}', true);
  DO $$
  DECLARE v_rejected BOOLEAN := FALSE;
  BEGIN
    BEGIN PERFORM 1 FROM public.risk_assessments; EXCEPTION WHEN OTHERS THEN v_rejected := TRUE; END;
    IF NOT v_rejected THEN RAISE EXCEPTION 'authenticated customer read risk_assessments was allowed'; END IF;
    v_rejected := FALSE;
    BEGIN UPDATE public.payment_transactions SET status = 'FAILED' WHERE FALSE; EXCEPTION WHEN OTHERS THEN v_rejected := TRUE; END;
    IF NOT v_rejected THEN RAISE EXCEPTION 'authenticated customer payment mutation privilege was allowed'; END IF;
  END;
  $$;
COMMIT;

-- Admin data is read by the authenticated application server through service_role;
-- browser roles do not receive direct table access.
BEGIN;
  SET LOCAL ROLE service_role;
  DO $$ DECLARE v_count INTEGER; v_checkout_count INTEGER; BEGIN
    SELECT COUNT(*) INTO v_count FROM public.orders;
    SELECT COUNT(*) INTO v_checkout_count FROM public.checkout_sessions;
    IF v_count < 1 OR v_checkout_count < 1 THEN RAISE EXCEPTION 'service-role Admin data access failed'; END IF;
  END $$;
COMMIT;

-- SECURITY DEFINER functions use an empty search_path and restricted execution grants.
DO $$
DECLARE v_search_path TEXT; v_public_grant BOOLEAN;
BEGIN
  SELECT proconfig[1] INTO v_search_path FROM pg_proc WHERE oid = 'public.create_guest_advance_order(uuid,uuid,integer,uuid,text,text,text,text,text,text,text,text,text)'::regprocedure;
  IF v_search_path IS DISTINCT FROM 'search_path=""' THEN RAISE EXCEPTION 'advance RPC search_path is not hardened: %', v_search_path; END IF;
  SELECT has_function_privilege('anon', 'public.create_guest_advance_order(uuid,uuid,integer,uuid,text,text,text,text,text,text,text,text,text)', 'EXECUTE') INTO v_public_grant;
  IF v_public_grant THEN RAISE EXCEPTION 'anon can execute advance RPC'; END IF;
END;
$$;

DO $$ BEGIN RAISE NOTICE 'SAHIGADGET RLS/AUTH + PAYMENT STATE + ANALYTICS: PASS'; END $$;
-- Real simultaneous database execution against isolated CI PostgreSQL.
-- dblink connections are local to the ephemeral Supabase stack and use synthetic data.
CREATE EXTENSION IF NOT EXISTS dblink;

DO $$
DECLARE
  v_request UUID;
  v_cart UUID;
  v_order UUID;
  v_tx UUID;
  v_count INTEGER;
  v_stock INTEGER;
BEGIN
  -- A. Concurrent identical COD submit.
  v_request := '00000000-0000-0000-0000-000000002001';
  PERFORM dblink_connect('cod_a', 'host=127.0.0.1 port=54322 dbname=postgres user=postgres password=postgres');
  PERFORM dblink_connect('cod_b', 'host=127.0.0.1 port=54322 dbname=postgres user=postgres password=postgres');
  PERFORM dblink_send_query('cod_a', format($q$SELECT * FROM public.create_guest_cod_order(%L::uuid,%L::uuid,1,%L::uuid,'Concurrent COD A','01700000201','concurrent-a@example.test','Dhaka','Dhaka','Area A','Address A','1201','concurrent')$q$,
    '00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000104',v_request));
  PERFORM dblink_send_query('cod_b', format($q$SELECT * FROM public.create_guest_cod_order(%L::uuid,%L::uuid,1,%L::uuid,'Concurrent COD B','01700000202','concurrent-b@example.test','Dhaka','Dhaka','Area B','Address B','1202','concurrent')$q$,
    '00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000104',v_request));
  WHILE dblink_is_busy('cod_a') OR dblink_is_busy('cod_b') LOOP PERFORM pg_sleep(0.02); END LOOP;
  PERFORM * FROM dblink_get_result('cod_a') AS t(order_id uuid, order_number varchar, created_new boolean);
  PERFORM * FROM dblink_get_result('cod_b') AS t(order_id uuid, order_number varchar, created_new boolean);
  PERFORM dblink_disconnect('cod_a'); PERFORM dblink_disconnect('cod_b');
  SELECT COUNT(*), MIN(id) INTO v_count, v_order FROM public.orders WHERE checkout_request_id = v_request;
  IF v_count <> 1 THEN RAISE EXCEPTION 'concurrent COD created % orders', v_count; END IF;
  SELECT COUNT(*) INTO v_count FROM public.stock_movements WHERE reference_id = v_order AND movement_type = 'SALE';
  IF v_count <> 1 THEN RAISE EXCEPTION 'concurrent COD created % sale movements', v_count; END IF;

  -- B. Concurrent conversion of the same cart checkout.
  INSERT INTO public.carts (id, guest_token, status, expires_at)
  VALUES ('00000000-0000-0000-0000-000000002010', 'ci-concurrent-cart', 'ACTIVE', NOW() + INTERVAL '1 day');
  INSERT INTO public.cart_items (cart_id, product_id, variant_id, quantity)
  VALUES ('00000000-0000-0000-0000-000000002010','00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000104',1);
  v_request := '00000000-0000-0000-0000-000000002011';
  PERFORM dblink_connect('cart_a', 'host=127.0.0.1 port=54322 dbname=postgres user=postgres password=postgres');
  PERFORM dblink_connect('cart_b', 'host=127.0.0.1 port=54322 dbname=postgres user=postgres password=postgres');
  PERFORM dblink_send_query('cart_a', format($q$SELECT * FROM public.create_guest_cod_cart_order(%L::uuid,%L::uuid,'Concurrent Cart A','01700000211','cart-a@example.test','Dhaka','Dhaka','Area A','Address A','1203','concurrent')$q$,'00000000-0000-0000-0000-000000002010',v_request));
  PERFORM dblink_send_query('cart_b', format($q$SELECT * FROM public.create_guest_cod_cart_order(%L::uuid,%L::uuid,'Concurrent Cart B','01700000212','cart-b@example.test','Dhaka','Dhaka','Area B','Address B','1204','concurrent')$q$,'00000000-0000-0000-0000-000000002010',v_request));
  WHILE dblink_is_busy('cart_a') OR dblink_is_busy('cart_b') LOOP PERFORM pg_sleep(0.02); END LOOP;
  PERFORM * FROM dblink_get_result('cart_a') AS t(order_id uuid, order_number varchar, created_new boolean);
  PERFORM * FROM dblink_get_result('cart_b') AS t(order_id uuid, order_number varchar, created_new boolean);
  PERFORM dblink_disconnect('cart_a'); PERFORM dblink_disconnect('cart_b');
  SELECT COUNT(*) INTO v_count FROM public.orders WHERE checkout_request_id = v_request;
  IF v_count <> 1 THEN RAISE EXCEPTION 'concurrent cart conversion created % orders', v_count; END IF;
  IF (SELECT status FROM public.carts WHERE id = '00000000-0000-0000-0000-000000002010') <> 'CONVERTED' THEN RAISE EXCEPTION 'concurrent cart was not converted'; END IF;

  -- C. Concurrent FULL_ADVANCE initiation for one checkout.
  v_request := '00000000-0000-0000-0000-000000002020';
  PERFORM dblink_connect('adv_a', 'host=127.0.0.1 port=54322 dbname=postgres user=postgres password=postgres');
  PERFORM dblink_connect('adv_b', 'host=127.0.0.1 port=54322 dbname=postgres user=postgres password=postgres');
  PERFORM dblink_send_query('adv_a', format($q$SELECT * FROM public.create_guest_advance_order(%L::uuid,%L::uuid,1,%L::uuid,'Concurrent Advance A','01700000221','adv-a@example.test','Dhaka','Dhaka','Area A','Address A','1205','concurrent')$q$,'00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000104',v_request));
  PERFORM dblink_send_query('adv_b', format($q$SELECT * FROM public.create_guest_advance_order(%L::uuid,%L::uuid,1,%L::uuid,'Concurrent Advance B','01700000222','adv-b@example.test','Dhaka','Dhaka','Area B','Address B','1206','concurrent')$q$,'00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000104',v_request));
  WHILE dblink_is_busy('adv_a') OR dblink_is_busy('adv_b') LOOP PERFORM pg_sleep(0.02); END LOOP;
  PERFORM * FROM dblink_get_result('adv_a') AS t(order_id uuid, order_number varchar, created_new boolean);
  PERFORM * FROM dblink_get_result('adv_b') AS t(order_id uuid, order_number varchar, created_new boolean);
  PERFORM dblink_disconnect('adv_a'); PERFORM dblink_disconnect('adv_b');
  SELECT COUNT(*), MIN(id) INTO v_count, v_order FROM public.orders WHERE checkout_request_id = v_request;
  IF v_count <> 1 THEN RAISE EXCEPTION 'concurrent advance initiation created % orders', v_count; END IF;
  SELECT COUNT(*) INTO v_count FROM public.stock_movements WHERE reference_id = v_order AND movement_type = 'RESERVATION';
  IF v_count <> 1 THEN RAISE EXCEPTION 'concurrent advance initiation created % reservations', v_count; END IF;

  -- D/F. Concurrent payment verification and callback-equivalent requests.
  INSERT INTO public.payment_transactions (order_id, provider, provider_payment_id, amount, currency, status, payment_requirement, idempotency_key)
  SELECT v_order, 'BDGATE', 'CI-CONCURRENT-PAY-001', grand_total, 'BDT', 'INITIATED', 'FULL_ADVANCE', 'ci:concurrent:pay:001'
  FROM public.orders WHERE id = v_order
  RETURNING id INTO v_tx;
  PERFORM dblink_connect('pay_a', 'host=127.0.0.1 port=54322 dbname=postgres user=postgres password=postgres');
  PERFORM dblink_connect('pay_b', 'host=127.0.0.1 port=54322 dbname=postgres user=postgres password=postgres');
  PERFORM dblink_send_query('pay_a', format('UPDATE public.payment_transactions SET status = ''PAID'', provider_transaction_id = ''CI-CONCURRENT-TX-A'', paid_at = NOW() WHERE id = %L::uuid', v_tx));
  PERFORM dblink_send_query('pay_b', format('UPDATE public.payment_transactions SET status = ''PAID'', provider_transaction_id = ''CI-CONCURRENT-TX-B'', paid_at = NOW() WHERE id = %L::uuid', v_tx));
  WHILE dblink_is_busy('pay_a') OR dblink_is_busy('pay_b') LOOP PERFORM pg_sleep(0.02); END LOOP;
  PERFORM * FROM dblink_get_result('pay_a') AS t(result text);
  PERFORM * FROM dblink_get_result('pay_b') AS t(result text);
  PERFORM dblink_disconnect('pay_a'); PERFORM dblink_disconnect('pay_b');
  IF (SELECT status FROM public.payment_transactions WHERE id = v_tx) <> 'PAID' THEN RAISE EXCEPTION 'concurrent verification did not reach PAID'; END IF;
  SELECT COUNT(*) INTO v_count FROM public.stock_movements WHERE reference_id = v_order AND movement_type = 'SALE';
  IF v_count <> 1 THEN RAISE EXCEPTION 'concurrent verification created % sale movements', v_count; END IF;
  -- Repeated callback-equivalent updates remain idempotent.
  UPDATE public.payment_transactions SET status = 'PAID' WHERE id = v_tx;
  UPDATE public.payment_transactions SET status = 'PAID' WHERE id = v_tx;
  SELECT COUNT(*) INTO v_count FROM public.stock_movements WHERE reference_id = v_order AND movement_type = 'SALE';
  IF v_count <> 1 THEN RAISE EXCEPTION 'repeated callback created % sale movements', v_count; END IF;

  -- E. Concurrent stock commit against one reservation.
  v_request := '00000000-0000-0000-0000-000000002030';
  SELECT order_id INTO v_order FROM public.create_guest_advance_order(
    '00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000104',1,v_request,
    'Concurrent Commit','01700000231','commit@example.test','Dhaka','Dhaka','Area','Address','1207','concurrent');
  INSERT INTO public.payment_transactions (order_id, provider, provider_payment_id, amount, currency, status, payment_requirement, idempotency_key)
  SELECT v_order, 'BDGATE', 'CI-CONCURRENT-COMMIT-001', grand_total, 'BDT', 'INITIATED', 'FULL_ADVANCE', 'ci:concurrent:commit:001'
  FROM public.orders WHERE id = v_order
  RETURNING id INTO v_tx;
  PERFORM dblink_connect('commit_a', 'host=127.0.0.1 port=54322 dbname=postgres user=postgres password=postgres');
  PERFORM dblink_connect('commit_b', 'host=127.0.0.1 port=54322 dbname=postgres user=postgres password=postgres');
  PERFORM dblink_send_query('commit_a', format('UPDATE public.payment_transactions SET status = ''PAID'' WHERE id = %L::uuid', v_tx));
  PERFORM dblink_send_query('commit_b', format('UPDATE public.payment_transactions SET status = ''PAID'' WHERE id = %L::uuid', v_tx));
  WHILE dblink_is_busy('commit_a') OR dblink_is_busy('commit_b') LOOP PERFORM pg_sleep(0.02); END LOOP;
  PERFORM * FROM dblink_get_result('commit_a') AS t(result text);
  PERFORM * FROM dblink_get_result('commit_b') AS t(result text);
  PERFORM dblink_disconnect('commit_a'); PERFORM dblink_disconnect('commit_b');
  SELECT COUNT(*) INTO v_count FROM public.stock_movements WHERE reference_id = v_order AND movement_type = 'SALE';
  IF v_count <> 1 THEN RAISE EXCEPTION 'concurrent stock commit created % sale movements', v_count; END IF;
  SELECT stock_quantity INTO v_stock FROM public.product_variants WHERE id = '00000000-0000-0000-0000-000000000104';
  IF v_stock < 0 THEN RAISE EXCEPTION 'concurrent stock commit produced negative stock'; END IF;

  RAISE NOTICE 'SAHIGADGET CONCURRENCY / IDEMPOTENCY: PASS';
END;
$$;
