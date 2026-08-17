'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from './auth'
import { writeAdminAuditLog } from './audit'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assistantControlConfigSchema,
  assistantPolicyConfigSchema,
} from '@/lib/assistant/config'

export type AssistantAdminActionResult = { ok: boolean; message: string }

async function saveSetting(key: string, value: unknown, description: string) {
  const db = createAdminClient()
  const { error } = await db.from('settings').upsert({ key, value, description, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error('Unable to save assistant settings.')
}

export async function saveAssistantControls(input: unknown): Promise<AssistantAdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const parsed = assistantControlConfigSchema.parse(input)
    await saveSetting('assistant_config', parsed, 'Admin-controlled public AI assistant behavior. Secrets are never stored here.')
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'ASSISTANT_CONFIG_UPDATED', entityType: 'assistant_config', details: { enabled: parsed.enabled, allowProductSearch: parsed.allowProductSearch, allowPolicyQuestions: parsed.allowPolicyQuestions, allowRecommendations: parsed.allowRecommendations, showQuickPrompts: parsed.showQuickPrompts, defaultLanguage: parsed.defaultLanguage, maxRequestsPerWindow: parsed.maxRequestsPerWindow, rateLimitWindowSeconds: parsed.rateLimitWindowSeconds, dailyRequestBudget: parsed.dailyRequestBudget } })
    revalidatePath('/admin/ai-assistant')
    return { ok: true, message: 'AI assistant controls saved.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message === 'ADMIN_FORBIDDEN' ? 'You do not have permission for this operation.' : 'Unable to save AI assistant controls.' }
  }
}

export async function saveAssistantPolicy(input: unknown): Promise<AssistantAdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const parsed = assistantPolicyConfigSchema.parse(input)
    await saveSetting('assistant_policy', parsed, 'Approved public assistant policy overrides. Empty values use canonical public sources.')
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'ASSISTANT_POLICY_UPDATED', entityType: 'assistant_policy', details: { delivery: Boolean(parsed.delivery), warranty: Boolean(parsed.warranty), returns: Boolean(parsed.returns), cod: Boolean(parsed.cod), support: Boolean(parsed.support), storeInformation: Boolean(parsed.storeInformation) } })
    revalidatePath('/admin/ai-assistant')
    return { ok: true, message: 'AI assistant policy sources saved.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message === 'ADMIN_FORBIDDEN' ? 'You do not have permission for this operation.' : 'Unable to save AI assistant policy sources.' }
  }
}
