import 'server-only'

import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'

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

export const DEFAULT_ASSISTANT_CONFIG: AssistantControlConfig = assistantControlConfigSchema.parse({})
export const DEFAULT_ASSISTANT_POLICY: AssistantPolicyConfig = assistantPolicyConfigSchema.parse({})

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

export function getAssistantConfigurationStatus(config: AssistantControlConfig) {
  const provider = process.env.ASSISTANT_LLM_PROVIDER?.trim().toLowerCase() || 'openai-compatible'
  const hasKey = Boolean(process.env.ASSISTANT_LLM_API_KEY?.trim())
  const hasModel = Boolean(process.env.ASSISTANT_LLM_MODEL?.trim())
  const hasUrl = provider === 'gemini'
    ? true
    : Boolean(process.env.ASSISTANT_LLM_API_URL?.trim())
  return {
    enabled: config.enabled,
    provider: provider === 'gemini' ? 'Gemini' : hasKey || hasModel || hasUrl ? 'OpenAI-compatible' : 'Not configured',
    providerConfigured: hasKey && hasModel && hasUrl,
    modelConfigured: hasModel,
    rateLimitConfigured: Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()),
    rateLimit: { maxRequestsPerWindow: config.maxRequestsPerWindow, windowSeconds: config.rateLimitWindowSeconds },
    dailyRequestBudget: config.dailyRequestBudget,
    secretsStoredInSettings: false,
  }
}
