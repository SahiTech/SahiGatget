-- The Cart COD RPC idempotency lookup is explicitly qualified in the
-- foundational commerce migration. Keep this migration as a harmless marker so
-- reset-from-zero remains stable across environments that already received the
-- correction through the canonical function definition.
SELECT 1;
NOTIFY pgrst, 'reload schema';
