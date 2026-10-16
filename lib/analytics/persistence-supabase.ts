import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { AnalyticsPersistenceAdapter, AnalyticsPersistenceInput, AnalyticsPersistenceResult } from './persistence'

export function createSupabaseAnalyticsPersistenceAdapter(): AnalyticsPersistenceAdapter {
  return {
    async recordEvent(input: AnalyticsPersistenceInput): Promise<AnalyticsPersistenceResult> {
      const db = createAdminClient()
      const { error } = await db.from('commerce_events').insert({
        event_id: input.eventId,
        event_name: input.eventName,
        session_id: input.sessionId ?? null,
        order_id: input.orderId ?? null,
        cart_id: input.cartId ?? null,
        metadata: input.metadata,
      })
      if (error?.code === '23505') return { ok: true, duplicate: true }
      if (error) return { ok: false, duplicate: false }
      return { ok: true, duplicate: false }
    },
  }
}
