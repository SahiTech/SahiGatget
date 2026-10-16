create or replace function public.create_admin_variant_with_initial_stock(
  p_product_id uuid,p_sku text,p_variant_title text,p_ram text,p_storage text,p_color text,
  p_price numeric,p_compare_at_price numeric,p_low_stock_threshold integer,p_is_active boolean,
  p_initial_stock integer,p_initial_cost numeric,p_actor_id uuid,p_idempotency_key uuid
) returns table(variant_id uuid,receipt_id uuid)
language plpgsql security definer set search_path=''
as $$
declare v_role text; v_variant uuid; v_receipt uuid;
begin
  select private.admin_role_for(p_actor_id) into v_role;
  if v_role not in ('OWNER','ADMIN') then raise exception 'ADMIN_FORBIDDEN'; end if;
  if p_initial_stock is null or p_initial_stock < 0 then raise exception 'INVALID_INITIAL_STOCK'; end if;
  if p_initial_stock > 0 and (p_initial_cost is null or p_initial_cost < 0) then raise exception 'INITIAL_COST_REQUIRED'; end if;
  if p_initial_cost is not null and p_initial_cost < 0 then raise exception 'INVALID_PURCHASE_COST'; end if;
  insert into public.product_variants(product_id,sku,variant_title,ram,storage,color,price,compare_at_price,stock_quantity,low_stock_threshold,is_active)
  values(p_product_id,btrim(p_sku),btrim(p_variant_title),nullif(btrim(p_ram),''),nullif(btrim(p_storage),''),nullif(btrim(p_color),''),p_price,p_compare_at_price,0,p_low_stock_threshold,p_is_active)
  returning id into v_variant;
  if p_initial_stock > 0 then
    select r.receipt_id into v_receipt from public.receive_inventory_stock(v_variant,p_initial_stock,p_initial_cost,null,null,now(),'Initial stock',p_actor_id,p_idempotency_key,'INITIAL') r;
  end if;
  return query select v_variant,v_receipt;
end;
$$;