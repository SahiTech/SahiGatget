'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from './auth'
import { writeAdminAuditLog } from './audit'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assistantControlConfigSchema,
  assistantPolicyConfigSchema,
  assistantProviderConfigSchema,
  getStoredAssistantProviderStatus,
  resolveAssistantProviderInput,
  saveStoredAssistantProviderConfig,
  toggleStoredAssistantProviderConfig,
} from '@/lib/assistant/config'
import { testAssistantProviderConnection } from '@/lib/assistant/service'

export type AssistantAdminActionResult = { ok: boolean; message: string }
export type ProviderActionResult = AssistantAdminActionResult & { status?: Awaited<ReturnType<typeof getStoredAssistantProviderStatus>> }

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
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'ASSISTANT_CONFIG_UPDATED', entityType: 'assistant_config', details: { enabled: parsed.enabled, allowProductSearch: parsed.allowProductSearch, allowPolicyQuestions: parsed.allowPolicyQuestions, allowRecommendations: parsed.allowRecommendations, showQuickPrompts: parsed.showQuickPrompts, defaultLanguage: parsed.defaultLanguage, maxRequestsPerWindow: parsed.maxRequestsPerWindow, rateLimitWindowSeconds: parsed.rateLimitWindowSeconds, dailyRequestBudget: parsed.dailyRequestBudget, temperature: parsed.temperature, maxTokens: parsed.maxTokens, requestTimeoutMs: parsed.requestTimeoutMs } })
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

export async function getAIConfigurationStatusAction(): Promise<ProviderActionResult> {
  try {
    await requireAdmin(['OWNER', 'ADMIN'])
    return { ok: true, message: 'AI provider status loaded.', status: await getStoredAssistantProviderStatus() }
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message === 'ADMIN_FORBIDDEN' ? 'You do not have permission for this operation.' : 'Unable to load AI provider status.' }
  }
}

export async function saveAIConfigurationAction(input: unknown): Promise<ProviderActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const parsed = assistantProviderConfigSchema.parse(input)
    await saveStoredAssistantProviderConfig(parsed, session.userId)
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'AI_CONFIG_UPDATED', entityType: 'assistant_provider_configurations', details: { provider: parsed.provider, model: parsed.model, enabled: parsed.enabled } })
    revalidatePath('/admin/ai-assistant')
    return { ok: true, message: 'AI provider configuration saved.', status: await getStoredAssistantProviderStatus() }
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message === 'ADMIN_FORBIDDEN' ? 'You do not have permission for this operation.' : 'Unable to save AI provider configuration.' }
  }
}

export async function testAIConfigurationAction(input: unknown): Promise<ProviderActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const parsed = assistantProviderConfigSchema.parse(input)
    const resolved = await resolveAssistantProviderInput(parsed)
    const result = await testAssistantProviderConnection(resolved)
    await writeAdminAuditLog({ actorUserId: session.userId, action: result.ok ? 'AI_CONNECTION_TESTED' : 'AI_CONNECTION_FAILED', entityType: 'assistant_provider_configurations', details: { provider: parsed.provider, model: parsed.model, ok: result.ok, usedExistingKey: !parsed.apiKey } })
    return { ok: result.ok, message: result.message, status: await getStoredAssistantProviderStatus() }
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message === 'ADMIN_FORBIDDEN' ? 'You do not have permission for this operation.' : 'Unable to test AI provider configuration.' }
  }
}

export async function toggleAIConfigurationAction(enabled: boolean): Promise<ProviderActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    await toggleStoredAssistantProviderConfig(Boolean(enabled), session.userId)
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'AI_CONFIG_UPDATED', entityType: 'assistant_provider_configurations', details: { enabled: Boolean(enabled) } })
    revalidatePath('/admin/ai-assistant')
    return { ok: true, message: enabled ? 'AI provider enabled.' : 'AI provider disabled.', status: await getStoredAssistantProviderStatus() }
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message === 'ADMIN_FORBIDDEN' ? 'You do not have permission for this operation.' : 'Unable to update AI provider state.' }
  }
}
