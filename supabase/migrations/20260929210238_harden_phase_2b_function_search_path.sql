-- Phase 2B security hardening: pin function search_path.

CREATE OR REPLACE FUNCTION public.claim_analytics_delivery_batch(
  p_limit integer DEFAULT 25,
  p_lease_seconds integer DEFAULT 300,
  p_max_attempts integer DEFAULT 8
)
RETURNS TABLE (
  event_id text,
  provider text,
  attempt_count integer,
  event_payload jsonb,
  lease_token uuid,
  lease_until timestamp with time zone
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_now timestamp with time zone := clock_timestamp();
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_lease_seconds integer := least(greatest(coalesce(p_lease_seconds, 300), 30), 900);
  v_max_attempts integer := greatest(coalesce(p_max_attempts, 8), 1);
BEGIN
  UPDATE public.analytics_delivery_ledger AS l
  SET
    status = 'DEAD',
    dead_letter_at = coalesce(l.dead_letter_at, v_now),
    lease_token = NULL,
    lease_until = NULL,
    next_attempt_at = NULL,
    category = coalesce(l.category, 'MAX_ATTEMPTS'),
    response_excerpt = coalesce(l.response_excerpt, 'Delivery attempts exhausted.'),
    updated_at = v_now
  WHERE l.status IN ('PENDING', 'FAILED')
    AND l.attempt_count >= v_max_attempts
    AND (l.lease_until IS NULL OR l.lease_until < v_now);

  RETURN QUERY
  WITH candidates AS (
    SELECT l.id
    FROM public.analytics_delivery_ledger AS l
    WHERE l.status IN ('PENDING', 'FAILED')
      AND l.attempt_count < v_max_attempts
      AND coalesce(l.next_attempt_at, v_now) <= v_now
      AND (l.lease_until IS NULL OR l.lease_until < v_now)
    ORDER BY l.next_attempt_at ASC NULLS FIRST, l.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  )
  UPDATE public.analytics_delivery_ledger AS l
  SET
    lease_token = extensions.uuid_generate_v4(),
    lease_until = v_now + make_interval(secs => v_lease_seconds),
    updated_at = v_now
  FROM candidates AS c
  WHERE l.id = c.id
  RETURNING
    l.event_id,
    l.provider,
    l.attempt_count,
    l.event_payload,
    l.lease_token,
    l.lease_until;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_analytics_delivery(
  p_event_id text,
  p_provider text,
  p_lease_token uuid,
  p_ok boolean,
  p_latency_ms integer DEFAULT NULL,
  p_http_status integer DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_response_excerpt text DEFAULT NULL,
  p_permanent_failure boolean DEFAULT false,
  p_max_attempts integer DEFAULT 8
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_now timestamp with time zone := clock_timestamp();
  v_new_attempt_count integer;
  v_status text;
  v_next_attempt_at timestamp with time zone;
  v_category text := left(nullif(p_category, ''), 120);
  v_excerpt text := left(nullif(p_response_excerpt, ''), 500);
  v_max_attempts integer := greatest(coalesce(p_max_attempts, 8), 1);
BEGIN
  SELECT l.attempt_count + 1
  INTO v_new_attempt_count
  FROM public.analytics_delivery_ledger AS l
  WHERE l.event_id = p_event_id
    AND l.provider = p_provider
    AND (
      (p_lease_token IS NOT NULL AND l.lease_token = p_lease_token AND (l.lease_until IS NULL OR l.lease_until >= v_now))
      OR
      (p_lease_token IS NULL AND l.lease_token IS NULL)
    )
  FOR UPDATE;

  IF v_new_attempt_count IS NULL THEN
    RETURN false;
  END IF;

  IF p_ok THEN
    v_status := 'SUCCEEDED';
    v_next_attempt_at := NULL;
  ELSIF p_permanent_failure OR v_new_attempt_count >= v_max_attempts THEN
    v_status := 'DEAD';
    v_next_attempt_at := NULL;
    v_category := coalesce(v_category, 'MAX_ATTEMPTS');
  ELSE
    v_status := 'FAILED';
    v_next_attempt_at := v_now + make_interval(
      secs => least(
        86400::double precision,
        300::double precision * power(2::double precision, least(v_new_attempt_count - 1, 10))
      )
    );
  END IF;

  UPDATE public.analytics_delivery_ledger AS l
  SET
    status = v_status,
    attempt_count = v_new_attempt_count,
    last_attempt_at = v_now,
    next_attempt_at = v_next_attempt_at,
    latency_ms = p_latency_ms,
    http_status = p_http_status,
    category = v_category,
    response_excerpt = v_excerpt,
    lease_token = NULL,
    lease_until = NULL,
    dead_letter_at = CASE WHEN v_status = 'DEAD' THEN coalesce(l.dead_letter_at, v_now) ELSE NULL END,
    updated_at = v_now
  WHERE l.event_id = p_event_id
    AND l.provider = p_provider
    AND (
      (p_lease_token IS NOT NULL AND l.lease_token = p_lease_token AND (l.lease_until IS NULL OR l.lease_until >= v_now))
      OR
      (p_lease_token IS NULL AND l.lease_token IS NULL)
    );

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_analytics_delivery(
  p_event_id text,
  p_provider text,
  p_lease_token uuid,
  p_delay_seconds integer DEFAULT 900,
  p_category text DEFAULT NULL,
  p_response_excerpt text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_now timestamp with time zone := clock_timestamp();
  v_delay integer := least(greatest(coalesce(p_delay_seconds, 900), 60), 86400);
BEGIN
  UPDATE public.analytics_delivery_ledger AS l
  SET
    status = CASE WHEN l.status = 'PENDING' THEN 'PENDING' ELSE 'FAILED' END,
    next_attempt_at = v_now + make_interval(secs => v_delay),
    category = left(nullif(p_category, ''), 120),
    response_excerpt = left(nullif(p_response_excerpt, ''), 500),
    lease_token = NULL,
    lease_until = NULL,
    updated_at = v_now
  WHERE l.event_id = p_event_id
    AND l.provider = p_provider
    AND l.lease_token = p_lease_token
    AND (l.lease_until IS NULL OR l.lease_until >= v_now);

  RETURN FOUND;
END;
$$;
