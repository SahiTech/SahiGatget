-- Phase 2B: claim exactly one delivery for inline dispatch.
-- Race-safe: an existing lease or terminal SUCCEEDED/DEAD row cannot be reused.

CREATE OR REPLACE FUNCTION public.claim_analytics_delivery(
  p_event_id text,
  p_provider text,
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
  WHERE l.event_id = p_event_id
    AND l.provider = p_provider
    AND l.status IN ('PENDING', 'FAILED')
    AND l.attempt_count >= v_max_attempts
    AND (l.lease_until IS NULL OR l.lease_until < v_now);

  RETURN QUERY
  UPDATE public.analytics_delivery_ledger AS l
  SET
    lease_token = extensions.uuid_generate_v4(),
    lease_until = v_now + make_interval(secs => v_lease_seconds),
    updated_at = v_now
  WHERE l.event_id = p_event_id
    AND l.provider = p_provider
    AND l.status IN ('PENDING', 'FAILED')
    AND l.attempt_count < v_max_attempts
    AND coalesce(l.next_attempt_at, v_now) <= v_now
    AND (l.lease_until IS NULL OR l.lease_until < v_now)
  RETURNING
    l.event_id,
    l.provider,
    l.attempt_count,
    l.event_payload,
    l.lease_token,
    l.lease_until;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_analytics_delivery(text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_analytics_delivery(text,text,integer,integer) TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS analytics_delivery_ledger_active_lease_idx
  ON public.analytics_delivery_ledger (event_id, provider)
  WHERE lease_token IS NOT NULL;
