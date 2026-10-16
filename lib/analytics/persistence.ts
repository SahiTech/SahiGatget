import 'server-only'

export type AnalyticsPersistenceInput = {
  eventId: string
  eventName: string
  sessionId?: string | null
  orderId?: string | null
  cartId?: string | null
  metadata: Record<string, unknown>
}

import { createSupabaseAnalyticsPersistenceAdapter } from './persistence-supabase'

export type AnalyticsPersistenceResult = {
  ok: boolean
  duplicate: boolean
}

export interface AnalyticsPersistenceAdapter {
  recordEvent(input: AnalyticsPersistenceInput): Promise<AnalyticsPersistenceResult>
}

export function getAnalyticsPersistenceAdapter(): AnalyticsPersistenceAdapter {
  return createSupabaseAnalyticsPersistenceAdapter()
}
