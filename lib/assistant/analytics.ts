import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export type AssistantAnalyticsAction = 'ASSISTANT_REQUEST' | 'ASSISTANT_UNANSWERED' | 'ASSISTANT_ERROR' | 'ASSISTANT_RATE_LIMITED'

const allowedActions = new Set<AssistantAnalyticsAction>(['ASSISTANT_REQUEST', 'ASSISTANT_UNANSWERED', 'ASSISTANT_ERROR', 'ASSISTANT_RATE_LIMITED'])

export async function recordAssistantAnalytics(action: AssistantAnalyticsAction, details: Record<string, string | number | boolean | null>) {
  if (!allowedActions.has(action)) return
  const safeDetails = Object.fromEntries(Object.entries(details).filter(([key, value]) => {
    if (/message|question|prompt|ip|session|email|phone|address|token|secret|password/i.test(key)) return false
    return value === null || ['string', 'number', 'boolean'].includes(typeof value)
  }))
  try {
    const db = createAdminClient()
    await db.from('audit_logs').insert({ user_id: null, action, entity_type: 'assistant', entity_id: null, details: safeDetails })
  } catch {
    // Analytics must never block or change the customer response.
  }
}
