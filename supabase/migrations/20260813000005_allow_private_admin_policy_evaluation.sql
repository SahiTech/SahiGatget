-- RLS policy expressions execute as the querying role. The helper remains in a non-exposed schema
-- with no schema USAGE grant, so this permits policy evaluation without making a REST/RPC endpoint public.
GRANT EXECUTE ON FUNCTION private.is_admin() TO anon, authenticated;
