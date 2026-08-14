CREATE TABLE IF NOT EXISTS public.customer_support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 2 AND 120),
  phone text NOT NULL CHECK (char_length(trim(phone)) BETWEEN 7 AND 30),
  email text NOT NULL CHECK (char_length(trim(email)) BETWEEN 5 AND 254),
  subject text NOT NULL CHECK (char_length(trim(subject)) BETWEEN 2 AND 160),
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 10 AND 5000),
  order_number text,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS customer_support_requests_status_created_idx
  ON public.customer_support_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS customer_support_requests_created_idx
  ON public.customer_support_requests(created_at DESC);

ALTER TABLE public.customer_support_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.customer_support_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.customer_support_requests TO service_role;

DROP POLICY IF EXISTS "No public access to customer support requests" ON public.customer_support_requests;
CREATE POLICY "No public access to customer support requests"
  ON public.customer_support_requests
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.customer_support_requests IS 'Private customer support requests. Public submissions are mediated by a server action; reads and updates are admin-only server-side.';
COMMENT ON COLUMN public.customer_support_requests.status IS 'NEW, IN_PROGRESS, RESOLVED, or CLOSED.';
COMMENT ON COLUMN public.customer_support_requests.resolved_by IS 'Authenticated admin user who resolved the request, when available.';

CREATE OR REPLACE FUNCTION public.set_customer_support_request_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status IN ('RESOLVED', 'CLOSED') AND OLD.status NOT IN ('RESOLVED', 'CLOSED') THEN
    NEW.resolved_at = COALESCE(NEW.resolved_at, now());
  ELSIF NEW.status NOT IN ('RESOLVED', 'CLOSED') THEN
    NEW.resolved_at = NULL;
    NEW.resolved_by = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_support_requests_updated_at ON public.customer_support_requests;
CREATE TRIGGER customer_support_requests_updated_at
  BEFORE UPDATE ON public.customer_support_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_customer_support_request_updated_at();

REVOKE ALL ON FUNCTION public.set_customer_support_request_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_customer_support_request_updated_at() TO service_role;

NOTIFY pgrst, 'reload schema';
