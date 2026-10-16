-- Phase 2B corrective migration: qualify claim function columns so
-- RETURNS TABLE output names cannot shadow ledger columns.

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
