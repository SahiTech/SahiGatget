alter table public.product_variants add constraint product_variants_product_id_id_key unique (product_id, id);
alter table public.product_images add column variant_id uuid null;
alter table public.product_images add constraint product_images_variant_id_fkey foreign key (variant_id) references public.product_variants(id) on delete set null;
alter table public.product_images add constraint product_images_product_variant_fkey foreign key (product_id, variant_id) references public.product_variants(product_id, id) on delete no action;
create index if not exists product_images_variant_id_idx on public.product_images(variant_id);
