-- Qualify the existing orders table fields inside the RETURN TABLE function body.
-- `order_number` is also an output column name, so an unqualified lookup is ambiguous in PL/pgSQL.
DO $$
DECLARE
  function_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.create_guest_cod_order(uuid,uuid,integer,uuid,text,text,text,text,text,text,text,text,text)'::regprocedure
  )
  INTO function_definition;

  function_definition := replace(
    function_definition,
    'SELECT id, order_number',
    'SELECT orders.id, orders.order_number'
  );

  EXECUTE function_definition;
END;
$$;
