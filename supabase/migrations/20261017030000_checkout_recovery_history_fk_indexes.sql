-- Cover the actor and linked-order foreign keys in recovery history.
create index if not exists checkout_recovery_history_actor_admin_user_idx
  on public.checkout_recovery_history(actor_admin_user_id);
create index if not exists checkout_recovery_history_linked_order_idx
  on public.checkout_recovery_history(linked_order_id);
