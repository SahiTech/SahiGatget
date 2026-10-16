-- Production advisor identified carts.customer_id as the remaining
-- unindexed foreign key after the broader FK-index rollout.
create index if not exists carts_customer_id_idx on public.carts(customer_id);
