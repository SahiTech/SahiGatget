import 'server-only'

import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret, encryptSecret } from '@/lib/delivery/secrets'

export const assistantControlConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maintenanceMode: z.boolean().default(false),
  assistantName: z.string().trim().min(1).max(80).default('SahiGadget AI Assistant'),
  buttonLabel: z.string().trim().min(1).max(80).default('সাহায্য লাগবে?'),
  maintenanceMessage: z.string().trim().max(300).default('AI Assistant is temporarily unavailable. Please try again later.'),
  maxVisibleProductCards: z.number().int().min(1).max(6).default(4),
  allowProductSearch: z.boolean().default(true),
  allowPolicyQuestions: z.boolean().default(true),
  allowRecommendations: z.boolean().default(true),
  showQuickPrompts: z.boolean().default(true),
  defaultLanguage: z.enum(['bn', 'en', 'auto']).default('bn'),
  maxRequestsPerWindow: z.number().int().min(1).max(100).default(12),
  rateLimitWindowSeconds: z.number().int().min(60).max(3600).default(300),
  dailyRequestBudget: z.number().int().min(1).max(100000).default(1000),
  systemInstructions: z.string().trim().max(2000).default('Answer only from verified SahiGadget public context. Never reveal private data or invent commerce facts.'),
  welcomeMessage: z.string().trim().max(500).default('হ্যালো! পণ্য, দাম, ভ্যারিয়েন্ট, ডেলিভারি বা ওয়ারেন্টি সম্পর্কে জানতে প্রশ্ন করুন।'),
  quickPrompts: z.array(z.string().trim().min(1).max(120)).max(6).default(['একটি পণ্য খুঁজে দিন', 'বাজেটের মধ্যে ফোন দেখান', 'ডেলিভারি সম্পর্কে জানতে চাই', 'ওয়ারেন্টি সম্পর্কে জানতে চাই']),
}).strict()

export type AssistantControlConfig = z.infer<typeof assistantControlConfigSchema>

export const assistantPolicyConfigSchema = z.object({
  delivery: z.string().trim().max(2000).default(''),
  warranty: z.string().trim().max(2000).default(''),
  returns: z.string().trim().max(3000).default(''),
  cod: z.string().trim().max(1500).default(''),
  support: z.string().trim().max(500).default(''),
  storeInformation: z.string().trim().max(1000).default(''),
}).strict()

export type AssistantPolicyConfig = z.infer<typeof assistantPolicyConfigSchema>

const SUPPORTED_ASSISTANT_PROVIDERS = ['OPENAI_COMPATIBLE', 'OPENAI', 'GEMINI'] as const
export const assistantProviderConfigSchema = z.object({
  provider: z.enum(SUPPORTED_ASSISTANT_PROVIDERS).default('OPENAI_COMPATIBLE'),
  apiUrl: z.string().trim().url().refine((value) => value.startsWith('https://'), 'The provider URL must use HTTPS.'),
  apiKey: z.string().trim().max(1000).optional(),
  model: z.string().trim().min(1).max(200),
  enabled: z.boolean().default(true),
}).strict()

export type AssistantProviderInput = z.infer<typeof assistantProviderConfigSchema>
export type AssistantProviderSource = 'ADMIN' | 'ENV' | 'NONE'
export type ResolvedAssistantProviderConfig = {
  provider: (typeof SUPPORTED_ASSISTANT_PROVIDERS)[number]
  apiUrl: string
  apiKey: string
  model: string
  source: Exclude<AssistantProviderSource, 'NONE'>
}

type StoredAssistantProviderConfig = {
  provider: (typeof SUPPORTED_ASSISTANT_PROVIDERS)[number]
  api_url: string
  encrypted_api_key: string
  model: string
  enabled: boolean
  created_at?: string
  updated_at?: string
  updated_by?: string | null
}

export const DEFAULT_ASSISTANT_CONFIG: AssistantControlConfig = assistantControlConfigSchema.parse({})
export const DEFAULT_ASSISTANT_POLICY: AssistantPolicyConfig = assistantPolicyConfigSchema.parse({})
const ASSISTANT_PROVIDER_CONFIG_ID = '00000000-0000-0000-0000-000000000001'

async function readStoredAssistantProviderConfig(): Promise<StoredAssistantProviderConfig | null> {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('assistant_provider_configurations')
      .select('provider, api_url, encrypted_api_key, model, enabled, created_at, updated_at, updated_by')
      .eq('id', ASSISTANT_PROVIDER_CONFIG_ID)
      .maybeSingle()
    if (error || !data) return null
    return data as StoredAssistantProviderConfig
  } catch {
    return null
  }
}

function assistantProviderName(value: string | undefined): ResolvedAssistantProviderConfig['provider'] {
  const normalized = value?.trim().toUpperCase()
  return SUPPORTED_ASSISTANT_PROVIDERS.includes(normalized as typeof SUPPORTED_ASSISTANT_PROVIDERS[number])
    ? normalized as ResolvedAssistantProviderConfig['provider']
    : 'OPENAI_COMPATIBLE'
}

function readEnvironmentProviderConfig(): ResolvedAssistantProviderConfig | null {
  const provider = assistantProviderName(process.env.ASSISTANT_LLM_PROVIDER)
  const apiUrl = process.env.ASSISTANT_LLM_API_URL?.trim()
  const apiKey = process.env.ASSISTANT_LLM_API_KEY?.trim()
  const model = process.env.ASSISTANT_LLM_MODEL?.trim()
  return apiUrl && apiKey && model ? { provider, apiUrl, apiKey, model, source: 'ENV' } : null
}

export async function resolveAssistantProviderConfig(): Promise<ResolvedAssistantProviderConfig | null> {
  const stored = await readStoredAssistantProviderConfig()
  if (stored) {
    if (!stored.enabled || !stored.api_url || !stored.encrypted_api_key || !stored.model) return null
    try {
      return { provider: stored.provider, apiUrl: stored.api_url, apiKey: decryptSecret(stored.encrypted_api_key), model: stored.model, source: 'ADMIN' }
    } catch {
      return null
    }
  }
  return readEnvironmentProviderConfig()
}

export async function resolveAssistantProviderInput(input: AssistantProviderInput): Promise<Omit<ResolvedAssistantProviderConfig, 'source'>> {
  const existing = await readStoredAssistantProviderConfig()
  const apiKey = input.apiKey?.trim() || (existing?.provider === input.provider && existing.api_url === input.apiUrl && existing.model === input.model ? decryptSecret(existing.encrypted_api_key) : '')
  if (!apiKey) throw new Error('An AI provider API key is required for the first configuration or when changing provider details.')
  return { provider: input.provider, apiUrl: input.apiUrl, apiKey, model: input.model }
}

export async function getStoredAssistantProviderStatus() {
  const stored = await readStoredAssistantProviderConfig()
  const environment = readEnvironmentProviderConfig()
  const source: AssistantProviderSource = stored ? 'ADMIN' : environment ? 'ENV' : 'NONE'
  return {
    adminConfigExists: Boolean(stored),
    adminConfigEnabled: stored?.enabled ?? null,
    providerConfigured: Boolean(stored?.enabled ? await resolveAssistantProviderConfig() : environment),
    providerSource: source,
    provider: stored?.provider ?? environment?.provider ?? null,
    apiUrl: stored?.api_url ?? environment?.apiUrl ?? null,
    model: stored?.model ?? environment?.model ?? null,
    apiKeyConfigured: Boolean(stored?.encrypted_api_key || environment?.apiKey),
    maskedApiKey: stored?.encrypted_api_key || environment?.apiKey ? '••••••••••••' : null,
  }
}

export async function saveStoredAssistantProviderConfig(input: AssistantProviderInput, updatedBy: string) {
  const db = createAdminClient()
  const existing = await readStoredAssistantProviderConfig()
  const sameProviderDetails = existing?.provider === input.provider && existing.api_url === input.apiUrl && existing.model === input.model
  const encryptedApiKey = input.apiKey?.trim() ? encryptSecret(input.apiKey.trim()) : sameProviderDetails ? existing?.encrypted_api_key : undefined
  if (!encryptedApiKey) throw new Error('An AI provider API key is required for the first configuration or when changing provider details.')
  const { error } = await db.from('assistant_provider_configurations').upsert({
    id: ASSISTANT_PROVIDER_CONFIG_ID,
    provider: input.provider,
    api_url: input.apiUrl,
    encrypted_api_key: encryptedApiKey,
    model: input.model,
    enabled: input.enabled,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) throw new Error('Unable to save AI provider configuration.')
}

export async function toggleStoredAssistantProviderConfig(enabled: boolean, updatedBy: string) {
  const db = createAdminClient()
  const existing = await readStoredAssistantProviderConfig()
  if (!existing) throw new Error('AI provider configuration is not configured.')
  const { error } = await db.from('assistant_provider_configurations').update({ enabled, updated_by: updatedBy, updated_at: new Date().toISOString() }).eq('id', ASSISTANT_PROVIDER_CONFIG_ID)
  if (error) throw new Error('Unable to update AI provider state.')
}

export async function loadAssistantPolicyConfig(): Promise<AssistantPolicyConfig> {
  try {
    const db = createAdminClient()
    const { data, error } = await db.from('settings').select('value').eq('key', 'assistant_policy').maybeSingle()
    if (error || !data) return DEFAULT_ASSISTANT_POLICY
    const parsed = assistantPolicyConfigSchema.safeParse(data.value)
    return parsed.success ? parsed.data : DEFAULT_ASSISTANT_POLICY
  } catch {
    return DEFAULT_ASSISTANT_POLICY
  }
}

export async function loadAssistantControlConfig(): Promise<AssistantControlConfig> {
  try {
    const db = createAdminClient()
    const { data, error } = await db.from('settings').select('value').eq('key', 'assistant_config').maybeSingle()
    if (error || !data) return DEFAULT_ASSISTANT_CONFIG
    const parsed = assistantControlConfigSchema.safeParse(data.value)
    return parsed.success ? parsed.data : DEFAULT_ASSISTANT_CONFIG
  } catch {
    return DEFAULT_ASSISTANT_CONFIG
  }
}

export async function getAssistantConfigurationStatus(config: AssistantControlConfig) {
  const provider = await getStoredAssistantProviderStatus()
  return {
    enabled: config.enabled,
    providerConfigured: provider.providerConfigured,
    providerSource: provider.providerSource,
    provider: provider.provider,
    apiUrl: provider.apiUrl,
    model: provider.model,
    apiKeyConfigured: provider.apiKeyConfigured,
    maskedApiKey: provider.maskedApiKey,
    adminConfigExists: provider.adminConfigExists,
    adminConfigEnabled: provider.adminConfigEnabled,
    rateLimitConfigured: Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()),
    rateLimit: { maxRequestsPerWindow: config.maxRequestsPerWindow, windowSeconds: config.rateLimitWindowSeconds },
    dailyRequestBudget: config.dailyRequestBudget,
    secretsStoredInSettings: false,
  }
}
