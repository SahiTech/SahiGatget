-- The cart COD RPC returns a record field named order_number. PostgreSQL
-- otherwise treats the unqualified order_number reference in its idempotency
-- lookup as ambiguous between the PL/pgSQL variable and public.orders column.
-- This function-local setting makes the table column authoritative without
-- duplicating or redesigning the established cart order pipeline.
ALTER FUNCTION public.create_guest_cod_cart_order(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) SET plpgsql.variable_conflict = 'use_column';

NOTIFY pgrst, 'reload schema';
