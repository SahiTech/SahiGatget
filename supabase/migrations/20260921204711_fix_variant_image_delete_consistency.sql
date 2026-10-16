create or replace function public.clear_product_image_variant_reference()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.product_images set variant_id = null, updated_at = now() where variant_id = old.id;
  return old;
end;
$$;

drop trigger if exists product_variants_clear_image_variant on public.product_variants;
create trigger product_variants_clear_image_variant
before delete on public.product_variants
for each row execute function public.clear_product_image_variant_reference();
