-- Phase 2B: run the durable analytics worker every minute.
-- The Authorization header is assembled from the private worker-auth row;
-- the secret is never stored in the cron command text.
SELECT cron.unschedule('analytics-delivery-worker')
WHERE EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'analytics-delivery-worker'
);

SELECT cron.schedule(
  'analytics-delivery-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://www.sahigadget.shop/api/analytics/worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT secret
        FROM public.analytics_worker_auth
        WHERE id = true
      )
    ),
    body := '{"source":"supabase_cron"}'::jsonb,
    timeout_milliseconds := 5000
  ) AS request_id;
  $$
);
