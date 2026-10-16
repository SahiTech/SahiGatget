import 'server-only'

import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export type ReceiveStockInput = {
  variantId: string
  quantity: number
  unitCost: number
  supplierName?: string
  supplierReference?: string
  receivedAt?: string
  note?: string
}

export async function receiveStock(input: ReceiveStockInput & { actorId: string }) {
  const db = createAdminClient()
  const { data, error } = await db.rpc('receive_inventory_stock', {
    p_variant_id: input.variantId,
    p_quantity: input.quantity,
    p_unit_cost: input.unitCost,
    p_supplier_name: input.supplierName ?? '',
    p_supplier_reference: input.supplierReference ?? '',
    p_received_at: input.receivedAt ?? new Date().toISOString(),
    p_note: input.note ?? '',
    p_actor_id: input.actorId,
    p_idempotency_key: randomUUID(),
    p_receipt_type: 'RECEIPT',
  })
  if (error || !data?.[0]) throw new Error(error?.message ?? 'Unable to receive stock.')
  return data[0]
}

export async function initializeInventoryCost(input: { variantId: string; unitCost: number; note?: string; actorId: string }) {
  const db = createAdminClient()
  const { data, error } = await db.rpc('initialize_inventory_cost', {
    p_variant_id: input.variantId,
    p_unit_cost: input.unitCost,
    p_actor_id: input.actorId,
    p_idempotency_key: randomUUID(),
    p_note: input.note ?? '',
  })
  if (error || !data?.[0]) throw new Error(error?.message ?? 'Unable to initialize inventory cost.')
  return data[0]
}
