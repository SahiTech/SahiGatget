-- Ensure the inventory receipt creator foreign key has a covering index.
create index if not exists inventory_receipts_created_by_idx
  on public.inventory_receipts(created_by);
