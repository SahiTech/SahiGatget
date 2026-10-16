-- Inventory receiving + weighted-average costing
create table if not exists public.inventory_cost_balances (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  costed_quantity integer not null default 0 check (costed_quantity >= 0),
  total_cost numeric(20,4) not null default 0 check (total_cost >= 0),
  costing_method text not null default 'WEIGHTED_AVERAGE' check (costing_method = 'WEIGHTED_AVERAGE'),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_receipts (
  id uuid primary key default extensions.uuid_generate_v4(),
  variant_id uuid not null references public.product_variants(id),
  receipt_type text not null default 'RECEIPT' check (receipt_type in ('INITIAL','RECEIPT','COST_INITIALIZATION')),
  quantity integer not null default 0 check (quantity >= 0),
  unit_cost numeric(20,4) not null check (unit_cost >= 0),
  supplier_name text,
  supplier_reference text,
  received_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  note text,
  idempotency_key uuid unique,
  movement_id uuid,
  created_at timestamptz not null default now()
);

alter table public.stock_movements add column if not exists unit_cost numeric(20,4);
alter table public.stock_movements add column if not exists receipt_id uuid references public.inventory_receipts(id);
alter table public.order_items add column if not exists unit_cost_snapshot numeric(20,4);
alter table public.order_items add column if not exists cost_total numeric(20,4);
alter table public.order_items add column if not exists gross_profit numeric(20,4);

create index if not exists inventory_receipts_variant_received_idx on public.inventory_receipts(variant_id, received_at desc);
create index if not exists stock_movements_receipt_idx on public.stock_movements(receipt_id);
create index if not exists order_items_cost_snapshot_idx on public.order_items(order_id, variant_id);

alter table public.inventory_cost_balances enable row level security;
alter table public.inventory_receipts enable row level security;

revoke all on public.inventory_cost_balances from anon, authenticated;
revoke all on public.inventory_receipts from anon, authenticated;
grant all on public.inventory_cost_balances to service_role;
grant all on public.inventory_receipts to service_role;

create or replace function public.receive_inventory_stock(
  p_variant_id uuid,
  p_quantity integer,
  p_unit_cost numeric,
  p_supplier_name text,
  p_supplier_reference text,
  p_received_at timestamptz,
  p_note text,
  p_actor_id uuid,
  p_idempotency_key uuid,
  p_receipt_type text default 'RECEIPT'
) returns table(receipt_id uuid, movement_id uuid, previous_stock integer, new_stock integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text;
  v_existing record;
  v_current integer;
  v_receipt_id uuid;
  v_movement_id uuid;
begin
  select private.admin_role_for(p_actor_id) into v_role;
  if v_role not in ('OWNER','ADMIN','STAFF') then raise exception 'ADMIN_FORBIDDEN'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'INVALID_RECEIVING_QUANTITY'; end if;
  if p_unit_cost is null or p_unit_cost < 0 then raise exception 'INVALID_PURCHASE_COST'; end if;
  if p_receipt_type not in ('INITIAL','RECEIPT') then raise exception 'INVALID_RECEIPT_TYPE'; end if;

  if p_idempotency_key is not null then
    select ir.id, ir.movement_id into v_existing from public.inventory_receipts ir where ir.idempotency_key = p_idempotency_key;
    if found then
      select pv.stock_quantity into v_current from public.product_variants pv where pv.id = p_variant_id;
      return query select v_existing.id, v_existing.movement_id, v_current - p_quantity, v_current;
      return;
    end if;
  end if;

  select pv.stock_quantity into v_current from public.product_variants pv where pv.id = p_variant_id for update;
  if not found then raise exception 'VARIANT_NOT_FOUND'; end if;

  insert into public.inventory_receipts(variant_id,receipt_type,quantity,unit_cost,supplier_name,supplier_reference,received_at,created_by,note,idempotency_key)
  values(p_variant_id,p_receipt_type,p_quantity,p_unit_cost,nullif(btrim(p_supplier_name),''),nullif(btrim(p_supplier_reference),''),coalesce(p_received_at,now()),p_actor_id,nullif(btrim(p_note),''),p_idempotency_key)
  returning id into v_receipt_id;

  update public.product_variants set stock_quantity = stock_quantity + p_quantity, updated_at = now() where id = p_variant_id;

  insert into public.stock_movements(variant_id,change_amount,movement_type,reference_id,notes,created_by,unit_cost,receipt_id)
  values(p_variant_id,p_quantity,case when p_receipt_type='INITIAL' then 'INITIAL_STOCK' else 'RESTOCK' end,v_receipt_id,coalesce(nullif(btrim(p_note),''),'Inventory stock received'),p_actor_id,p_unit_cost,v_receipt_id)
  returning id into v_movement_id;

  update public.inventory_receipts set movement_id=v_movement_id where id=v_receipt_id;

  insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
  values(p_actor_id,'INVENTORY_RECEIVED','inventory_receipt',v_receipt_id,jsonb_build_object('variant_id',p_variant_id,'quantity',p_quantity,'unit_cost',p_unit_cost,'previous_stock',v_current,'resulting_stock',v_current+p_quantity,'supplier',p_supplier_name,'reference',p_supplier_reference));

  return query select v_receipt_id,v_movement_id,v_current,v_current+p_quantity;
end;
$$;

revoke execute on function public.receive_inventory_stock(uuid,integer,numeric,text,text,timestamptz,text,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.receive_inventory_stock(uuid,integer,numeric,text,text,timestamptz,text,uuid,uuid,text) to service_role;

create or replace function public.initialize_inventory_cost(
  p_variant_id uuid,
  p_unit_cost numeric,
  p_actor_id uuid,
  p_idempotency_key uuid,
  p_note text
) returns table(receipt_id uuid, stock_quantity integer, unit_cost numeric)
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text;
  v_stock integer;
  v_id uuid;
begin
  select private.admin_role_for(p_actor_id) into v_role;
  if v_role not in ('OWNER','ADMIN','STAFF') then raise exception 'ADMIN_FORBIDDEN'; end if;
  if p_unit_cost is null or p_unit_cost < 0 then raise exception 'INVALID_PURCHASE_COST'; end if;
  select stock_quantity into v_stock from public.product_variants where id=p_variant_id for update;
  if not found then raise exception 'VARIANT_NOT_FOUND'; end if;
  if p_idempotency_key is not null then
    select id into v_id from public.inventory_receipts where idempotency_key=p_idempotency_key;
    if found then return query select v_id,v_stock,p_unit_cost; return; end if;
  end if;
  insert into public.inventory_receipts(variant_id,receipt_type,quantity,unit_cost,created_by,note,idempotency_key)
  values(p_variant_id,'COST_INITIALIZATION',v_stock,p_unit_cost,p_actor_id,nullif(btrim(p_note),''),p_idempotency_key)
  returning id into v_id;
  insert into public.inventory_cost_balances(variant_id,costed_quantity,total_cost,costing_method)
  values(p_variant_id,v_stock,v_stock*p_unit_cost,'WEIGHTED_AVERAGE')
  on conflict (variant_id) do update set costed_quantity=excluded.costed_quantity,total_cost=excluded.total_cost,costing_method='WEIGHTED_AVERAGE',updated_at=now();
  insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
  values(p_actor_id,'INVENTORY_COST_INITIALIZED','product_variant',p_variant_id,jsonb_build_object('stock_quantity',v_stock,'unit_cost',p_unit_cost,'receipt_id',v_id));
  return query select v_id,v_stock,p_unit_cost;
end;
$$;

revoke execute on function public.initialize_inventory_cost(uuid,numeric,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.initialize_inventory_cost(uuid,numeric,uuid,uuid,text) to service_role;

create or replace function public.inventory_cost_movement_trigger()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_balance record;
  v_avg numeric;
  v_qty integer := abs(new.change_amount);
  v_order_cost numeric;
begin
  if new.unit_cost is null and new.movement_type in ('SALE','RESERVATION','DAMAGE','RETURN','RELEASE') then
    if new.movement_type='RELEASE' then
      select sm.unit_cost into new.unit_cost from public.stock_movements sm where sm.reference_id=new.reference_id and sm.movement_type='RESERVATION' order by sm.created_at desc limit 1;
    elsif new.movement_type='RETURN' then
      select oi.unit_cost_snapshot into v_order_cost from public.order_items oi where oi.order_id=new.reference_id and oi.variant_id=new.variant_id and oi.unit_cost_snapshot is not null limit 1;
      new.unit_cost := v_order_cost;
    else
      select total_cost / nullif(costed_quantity,0) into v_avg from public.inventory_cost_balances where variant_id=new.variant_id and costed_quantity>0;
      new.unit_cost := v_avg;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inventory_cost_before_movement on public.stock_movements;
create trigger trg_inventory_cost_before_movement before insert or update of movement_type,unit_cost on public.stock_movements for each row execute function public.inventory_cost_movement_trigger();

create or replace function public.inventory_cost_after_movement_trigger()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_cost numeric := new.unit_cost;
  v_qty integer := abs(new.change_amount);
  v_costed integer;
  v_total numeric;
  v_delta numeric;
  v_item record;
begin
  if new.movement_type in ('INITIAL_STOCK','RESTOCK','RETURN','RELEASE') and v_cost is not null then
    insert into public.inventory_cost_balances(variant_id,costed_quantity,total_cost,costing_method)
    values(new.variant_id,v_qty,v_qty*v_cost,'WEIGHTED_AVERAGE')
    on conflict (variant_id) do update set costed_quantity=public.inventory_cost_balances.costed_quantity+excluded.costed_quantity,total_cost=public.inventory_cost_balances.total_cost+excluded.total_cost,updated_at=now();
  elsif new.movement_type in ('SALE','RESERVATION','DAMAGE') and v_cost is not null then
    select costed_quantity,total_cost into v_costed,v_total from public.inventory_cost_balances where variant_id=new.variant_id for update;
    if found and v_costed > 0 then
      v_delta := least(v_qty,v_costed)*v_cost;
      update public.inventory_cost_balances set costed_quantity=costed_quantity-least(v_qty,v_costed),total_cost=greatest(total_cost-v_delta,0),updated_at=now() where variant_id=new.variant_id;
    end if;
  end if;

  if new.movement_type='SALE' and new.reference_id is not null and v_cost is not null then
    for v_item in select id,quantity,unit_price from public.order_items where order_id=new.reference_id and variant_id=new.variant_id and unit_cost_snapshot is null order by created_at loop
      update public.order_items set unit_cost_snapshot=v_cost,cost_total=v_cost*v_item.quantity,gross_profit=(v_item.unit_price-v_cost)*v_item.quantity where id=v_item.id;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inventory_cost_after_movement on public.stock_movements;
create trigger trg_inventory_cost_after_movement after insert on public.stock_movements for each row execute function public.inventory_cost_after_movement_trigger();

create or replace function public.inventory_cost_after_movement_update_trigger()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_item record;
begin
  if old.movement_type in ('RESERVATION') and new.movement_type='SALE' and new.reference_id is not null and new.unit_cost is not null then
    for v_item in select id,quantity,unit_price from public.order_items where order_id=new.reference_id and variant_id=new.variant_id and unit_cost_snapshot is null order by created_at loop
      update public.order_items set unit_cost_snapshot=new.unit_cost,cost_total=new.unit_cost*v_item.quantity,gross_profit=(v_item.unit_price-new.unit_cost)*v_item.quantity where id=v_item.id;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inventory_cost_after_movement_update on public.stock_movements;
create trigger trg_inventory_cost_after_movement_update after update of movement_type on public.stock_movements for each row execute function public.inventory_cost_after_movement_update_trigger();

revoke execute on function public.inventory_cost_movement_trigger() from public,anon,authenticated;
revoke execute on function public.inventory_cost_after_movement_trigger() from public,anon,authenticated;
revoke execute on function public.inventory_cost_after_movement_update_trigger() from public,anon,authenticated;

create or replace view public.admin_inventory_cost_summary
with (security_invoker=false) as
select pv.id variant_id,pv.product_id,pv.sku,pv.variant_title,pv.stock_quantity,pv.price,
       ic.costed_quantity,
       case when ic.costed_quantity = pv.stock_quantity and pv.stock_quantity > 0 then ic.total_cost / pv.stock_quantity else null end average_cost,
       case when ic.costed_quantity = pv.stock_quantity then ic.total_cost else null end inventory_value,
       case when ic.costed_quantity = pv.stock_quantity and pv.stock_quantity > 0 then pv.price - (ic.total_cost / pv.stock_quantity) else null end potential_gross_profit_per_unit,
       ic.costing_method
from public.product_variants pv
left join public.inventory_cost_balances ic on ic.variant_id=pv.id;

revoke all on public.admin_inventory_cost_summary from anon,authenticated;
grant select on public.admin_inventory_cost_summary to service_role;
