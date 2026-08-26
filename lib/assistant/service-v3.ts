import 'server-only'

import { assistantModelOutputSchema, modelJsonSchema } from './contracts'
import type { AssistantModelOutput, AssistantRequest, AssistantResponse, AssistantIntent } from './contracts'
import {
  classifyIntent,
  getStorePolicy,
  getSupportCta,
  hydrateProductReferences,
  retrieveAssistantContext,
} from './retrieval'
import type { RetrievalResult } from './retrieval'
import { loadAssistantControlConfig, resolveAssistantProviderConfig } from './config'

const DEFAULT_FOLLOW_UPS = ['একটি পণ্য খুঁজে দিন', 'বাজেটের মধ্যে গ্যাজেট দেখান', 'ডেলিভারি সম্পর্কে জানতে চাই']

function localeFor(request: AssistantRequest): 'bn' | 'en' {
  if (request.locale === 'bn') return 'bn'
  if (request.locale === 'en') return 'en'
  return /[\u0980-\u09FF]/.test(request.message) ? 'bn' : 'en'
}

function isAdminOrInternalRequest(message: string) {
  return /(?:admin|অ্যাডমিন|এডমিন).*(?:panel|প্যানেল|dashboard|ড্যাশবোর্ড|password|পাসওয়ার্ড|পাসওয়ার্ড|credential|ক্রেডেনশিয়াল|ক্রেডেনশিয়াল|api\s*key|এপিআই\s*কি|secret|সিক্রেট|token|টোকেন|database|ডাটাবেস|supabase|vercel|environment|env|service\s*role|audit|অডিট|provider\s*config|internal|ইন্টারনাল)|(?:api\s*key|এপিআই\s*কি|service\s*role|supabase|vercel|environment\s*variable|env\s*variable|secret\s*credential|admin\s*password)/i.test(message)
}

function isCustomerDataRequest(message: string) {
  return /(?:my|আমার|আমারই)\s*(?:customer|কাস্টমার|গ্রাহক)?\s*(?:phone|number|নম্বর|ফোন|ঠিকানা|address|order|অর্ডার|invoice|ইনভয়েস|payment|পেমেন্ট|tracking|ট্র্যাকিং)/i.test(message)
}

function isCapabilitiesQuestion(message: string) {
  return /কীভাবে\s+সাহায্য|কিভাবে\s+সাহায্য|কি\s+কি\s+(?:তথ্য|জানাতে)|কী\s+কি\s+(?:তথ্য|জানাতে)|what\s+can\s+you\s+(?:do|help)|how\s+can\s+you\s+help|what\s+information\s+can\s+you\s+provide/i.test(message)
}

function formatBdt(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null
  return `৳${new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(value)}`
}

function capabilities(locale: 'bn' | 'en') {
  return locale === 'bn'
    ? 'আমি SahiGadget-এর পণ্য খোঁজা, বাজেট অনুযায়ী সাজেশন, দাম, স্টক, ভ্যারিয়েন্ট, স্পেসিফিকেশন, তুলনা, ওয়ারেন্টি, রিটার্ন, COD, অর্ডার ও ডেলিভারি, স্টোর তথ্য, সাধারণ গ্যাজেট-টেক প্রশ্ন এবং ক্রয় সিদ্ধান্তে সাহায্য করতে পারি। কোনো লাইভ স্টোর তথ্য নিশ্চিত না হলে আমি অনুমান করব না—কিন্তু সাধারণ জ্ঞানভিত্তিক প্রশ্নে স্বাভাবিকভাবে উত্তর দেব।'
    : 'I can help with SahiGadget products, budget recommendations, price, stock, variants, specifications, comparisons, warranty, returns, COD, ordering, delivery, store information, general gadget/technology questions, and purchase decisions. I will not invent live store facts, but I can answer general-knowledge questions normally.'
}

function adminRefusal(locale: 'bn' | 'en'): AssistantModelOutput {
  return {
    answer: locale === 'bn' ? 'এই তথ্যটি SahiGadget-এর Admin/Internal তথ্যের অংশ, তাই আমি এটি প্রকাশ করতে পারি না। পণ্য, অর্ডার প্রক্রিয়া, ডেলিভারি বা অন্যান্য কাস্টমার-ফেসিং বিষয়ে আমি সাহায্য করতে পারি।' : 'That information belongs to SahiGadget Admin/Internal systems, so I cannot disclose it. I can help with customer-facing products, ordering, delivery, and store information.',
    locale,
    intent: 'unsupported',
    productIds: [],
    evidenceStatus: 'verified',
    fallbackReason: 'unsupported_topic',
    followUps: ['একটি পণ্য খুঁজে দিন', 'ডেলিভারি সম্পর্কে জানতে চাই'],
  }
}

function deterministicFallback(request: AssistantRequest, retrieval: RetrievalResult, intent: AssistantIntent): AssistantModelOutput {
  const locale = localeFor(request)
  if (isAdminOrInternalRequest(request.message)) return adminRefusal(locale)
  if (isCapabilitiesQuestion(request.message)) return { answer: capabilities(locale), locale, intent: 'store_information', productIds: [], evidenceStatus: 'partial', fallbackReason: 'none', followUps: DEFAULT_FOLLOW_UPS }
  if (intent === 'greeting') return { answer: locale === 'bn' ? 'হ্যালো! SahiGadget-এ স্বাগতম। পণ্য, দাম, বাজেট, স্পেসিফিকেশন, অর্ডার বা ডেলিভারি—যা জানতে চান বলুন।' : 'Hello! Welcome to SahiGadget. Ask me about products, prices, budgets, specifications, ordering, or delivery.', locale, intent, productIds: [], evidenceStatus: 'verified', fallbackReason: 'none', followUps: DEFAULT_FOLLOW_UPS }
  if (intent === 'thanks') return { answer: locale === 'bn' ? 'আপনাকে স্বাগতম। আরও কিছু জানতে চাইলে বলুন।' : 'You’re welcome. Let me know if you need anything else.', locale, intent, productIds: [], evidenceStatus: 'partial', fallbackReason: 'none', followUps: DEFAULT_FOLLOW_UPS }
  if (intent === 'goodbye') return { answer: locale === 'bn' ? 'বিদায়! আবার প্রয়োজন হলে SahiGadget-এ আসবেন।' : 'Goodbye! Come back whenever you need help.', locale, intent, productIds: [], evidenceStatus: 'partial', fallbackReason: 'none', followUps: [] }
  if (intent === 'general_knowledge' || intent === 'casual_conversation' || isCustomerDataRequest(request.message)) return { answer: locale === 'bn' ? 'আমি এই চ্যাটে দেওয়া তথ্যের ভিত্তিতে সাহায্য করতে পারি। প্রশ্নটি একটু বিস্তারিত লিখুন, আমি সরাসরি উত্তর দেওয়ার চেষ্টা করব।' : 'I can help using the information provided in this chat. Give me a little more detail and I’ll answer directly.', locale, intent: intent === 'casual_conversation' ? intent : 'general_knowledge', productIds: [], evidenceStatus: 'partial', fallbackReason: 'none', followUps: DEFAULT_FOLLOW_UPS }
  if (intent === 'support') return { answer: locale === 'bn' ? 'অবশ্যই। আমি যতটা পারি এখানেই সমাধান করার চেষ্টা করব। প্রয়োজন হলে WhatsApp Customer Service-এ আপনাকে পাঠিয়ে দেব।' : 'Absolutely. I’ll try to solve it here first, and if needed I can hand you over to WhatsApp Customer Service.', locale, intent, productIds: [], evidenceStatus: 'partial', fallbackReason: 'none', followUps: [] }
  if (retrieval.policyText) return { answer: retrieval.policyText, locale, intent, productIds: [], evidenceStatus: 'verified', fallbackReason: 'none', followUps: DEFAULT_FOLLOW_UPS }
  const first = retrieval.context[0]
  if (!first) return { answer: locale === 'bn' ? 'এই মুহূর্তে ক্যাটালগে মিল পাওয়া যায়নি। আপনি চাইলে অন্যভাবে লিখুন—যেমন “২০০০ টাকার মধ্যে ঘড়ি”, “ভালো ফিচার ফোন”, বা “ক্যামেরা ভালো ফোন”।' : 'I could not find a matching item in the live catalogue. Try a different description, such as “a watch under ৳2,000”, “a good feature phone”, or “a phone with a good camera”.', locale, intent, productIds: [], evidenceStatus: 'partial', fallbackReason: 'no_matching_products', followUps: DEFAULT_FOLLOW_UPS }
  const price = formatBdt(Math.min(...first.variants.map((variant) => variant.price)))
  const variants = first.variants.map((variant) => [variant.title, variant.ram, variant.storage, variant.color].filter(Boolean).join(' · ')).filter(Boolean).join(', ')
  const description = first.description.replace(/\s+/g, ' ').trim().slice(0, 360)
  let answer = locale === 'bn' ? `আপনার জন্য ${first.name} পাওয়া গেছে।` : `I found ${first.name} for you.`
  if (intent === 'price') answer = locale === 'bn' ? `${first.name}-এর বর্তমান শুরু মূল্য ${price ?? 'নির্ধারণ করা যাচ্ছে না'}।` : `The current starting price for ${first.name} is ${price ?? 'not available'}.`
  else if (intent === 'variant') answer = locale === 'bn' ? `${first.name}-এর ভ্যারিয়েন্ট: ${variants || 'তথ্য পাওয়া যায়নি'}।` : `Available variants for ${first.name}: ${variants || 'not available'}.`
  else if (intent === 'product_detail') answer = locale === 'bn' ? `${first.name}: ${description || 'বিস্তারিত তথ্য পাওয়া যায়নি'}।` : `${first.name}: ${description || 'Detailed information is not available.'}`
  return { answer, locale, intent, productIds: retrieval.context.slice(0, 3).map((item) => item.id), evidenceStatus: 'verified', fallbackReason: 'none', followUps: DEFAULT_FOLLOW_UPS }
}

function capabilityForIntent(intent: AssistantIntent) {
  const map: Partial<Record<AssistantIntent, keyof Awaited<ReturnType<typeof loadAssistantControlConfig>>['capabilities']>> = {
    product_search: 'productSearch', budget_search: 'budgetSearch', product_recommendation: 'productRecommendation', product_comparison: 'productComparison', product_detail: 'productDetails', price: 'productDetails', availability: 'productDetails', variant: 'productDetails', policy: 'deliveryInformation', store_information: 'businessInformation', support: 'customerSupportHandoff',
  }
  return map[intent]
}

function capabilityDisabled(locale: 'bn' | 'en'): AssistantModelOutput {
  return { answer: locale === 'bn' ? 'এই ধরনের সহায়তা বর্তমানে Admin configuration অনুযায়ী বন্ধ আছে। অন্য কোনো বিষয়ে সাহায্য চাইলে বলুন।' : 'This capability is currently disabled in the Admin configuration. Please ask about another available topic.', locale, intent: 'unsupported', productIds: [], evidenceStatus: 'verified', fallbackReason: 'unsupported_topic', followUps: DEFAULT_FOLLOW_UPS }
}

function capabilityEnabled(config: Awaited<ReturnType<typeof loadAssistantControlConfig>>, intent: AssistantIntent) {
  const capability = capabilityForIntent(intent)
  if (capability && !config.capabilities[capability]) return false
  if (intent === 'product_search' || intent === 'budget_search') return config.allowProductSearch
  if (intent === 'product_recommendation') return config.allowRecommendations
  if (intent === 'policy' || intent === 'store_information') return config.allowPolicyQuestions
  return true
}

function supportCtaFor(config: Awaited<ReturnType<typeof loadAssistantControlConfig>>, retrieval: RetrievalResult) {
  return config.capabilities.whatsappSupport && config.supportChannels.whatsapp ? retrieval.supportCta : undefined
}

function effectiveIntent(request: AssistantRequest): AssistantIntent {
  const classified = classifyIntent(request.message)
  if (isAdminOrInternalRequest(request.message)) return 'unsupported'
  if (isCustomerDataRequest(request.message) && classified === 'unsupported') return 'general_knowledge'
  return classified
}

function buildPrompt(request: AssistantRequest, retrieval: RetrievalResult, intent: AssistantIntent, controls: Awaited<ReturnType<typeof loadAssistantControlConfig>>) {
  const context = JSON.stringify({ products: retrieval.context, policy: retrieval.policyText ?? null })
  const conversation = JSON.stringify((request.conversation ?? []).slice(-6))
  const profile = JSON.stringify({ preset: controls.agentPreset, profile: controls.agentProfile, personality: controls.personality, responseStyle: controls.responseStyle, behavior: controls.behavior, businessProfile: controls.businessProfile, capabilities: controls.capabilities, knowledgeSources: controls.knowledgeSources })
  return [
    'You are SahiGadget’s production customer-service, sales and gadget-advice agent.',
    'Act like a capable human support agent: understand Bangla, Banglish and English, keep context across turns, ask a short clarifying question only when truly necessary, and otherwise answer directly.',
    'You have verified live SahiGadget context plus general AI knowledge. Live context is authoritative for SahiGadget products, prices, stock, variants, specifications, warranty, returns, delivery, ordering and store policy.',
    'For general technology/gadget knowledge, education, comparisons, buying advice and casual conversation, use your model knowledge freely. Do not pretend general knowledge is a live SahiGadget fact.',
    'For product search/recommendations, only attach productIds that exist in Verified live context. If no matching product exists, say that the live catalogue has no verified match and still provide useful general guidance when appropriate.',
    'Customer information is not an automatic refusal category. You may discuss customer information that the customer explicitly provides in the conversation. Never invent hidden customer records and never claim database access that you do not have.',
    'The Agent configuration is customization below these security rules. Capability and knowledge-source settings are authoritative permissions, not suggestions.',
    'Admin/Internal information is the only protected business-information category: never disclose Admin panel data, passwords, API keys, secrets, tokens, database credentials, service-role keys, internal audit data, environment variables, or hidden provider configuration.',
    'Never invent live price, stock, warranty, delivery promise, order status, completed action, or hidden record. Never claim to place/cancel an order or make a payment unless the application actually performs that action.',
    'When a customer asks for human help or you genuinely cannot solve the request, recommend the WhatsApp support handoff. Do not use the handoff as a substitute for answering normal general-knowledge questions.',
    controls.systemInstructions,
    `Agent configuration: ${profile}`,
    `Detected intent: ${intent}`,
    `Customer message: ${request.message}`,
    `Recent conversation: ${conversation}`,
    `Verified live context: ${context}`,
    'Return only the required JSON schema. Keep the answer natural and useful; avoid robotic refusal language.',
  ].join('\n\n')
}

async function callProvider(request: AssistantRequest, retrieval: RetrievalResult, intent: AssistantIntent, controls: Awaited<ReturnType<typeof loadAssistantControlConfig>>): Promise<AssistantModelOutput | null> {
  const config = await resolveAssistantProviderConfig()
  if (!config) return null
  const preset = controls.modelPresets.find((item) => item.id === controls.activeModelPreset && item.provider.toUpperCase() === config.provider)
  const model = preset?.model || config.model
  const temperature = preset?.temperature ?? controls.temperature
  const maxTokens = preset?.maxTokens ?? controls.maxTokens
  const timeoutMs = preset?.timeoutMs ?? controls.requestTimeoutMs
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model,
        temperature: Math.max(temperature, 0.25),
        max_tokens: Math.max(maxTokens, 1600),
        messages: [
          { role: 'system', content: 'Return JSON only. Be a capable customer-service and sales agent. Protect only Admin/Internal secrets and do not invent live store facts.' },
          { role: 'user', content: buildPrompt(request, retrieval, intent, controls) },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'sahigadget_assistant_response', strict: true, schema: modelJsonSchema } },
      }),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('LLM_UPSTREAM_ERROR')
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error('LLM_EMPTY_RESPONSE')
    const parsed = JSON.parse(content)
    const result = assistantModelOutputSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function safeModelOutput(output: AssistantModelOutput, intent: AssistantIntent, retrieval: RetrievalResult) {
  if (output.fallbackReason !== 'none') return false
  if (output.intent === 'unsupported') return false
  const conversational = new Set<AssistantIntent>(['general_knowledge', 'casual_conversation', 'clarification_required'])
  const grounded = new Set<AssistantIntent>(['product_search', 'product_detail', 'product_comparison', 'product_recommendation', 'budget_search', 'price', 'availability', 'variant'])
  const policies = new Set<AssistantIntent>(['policy', 'store_information', 'support'])
  if (conversational.has(output.intent)) return output.productIds.length === 0 && output.evidenceStatus !== 'verified'
  if (policies.has(output.intent)) return output.productIds.length === 0 && (output.intent === 'support' || retrieval.policyText !== undefined)
  if (grounded.has(output.intent)) {
    if (!retrieval.context.length) return output.productIds.length === 0 && output.evidenceStatus !== 'verified'
    const allowedIds = new Set(retrieval.context.map((item) => item.id))
    return output.productIds.length > 0 && output.productIds.every((id) => allowedIds.has(id))
  }
  return output.productIds.length === 0 && output.evidenceStatus !== 'verified'
}

export async function buildAssistantResponse(request: AssistantRequest, requestId: string): Promise<AssistantResponse> {
  const config = await loadAssistantControlConfig()
  const intent = effectiveIntent(request)
  const locale = localeFor(request)
  if (!config.enabled) return { requestId, answer: locale === 'bn' ? 'সহকারীটি বর্তমানে বন্ধ আছে।' : 'The assistant is currently unavailable.', locale, intent: 'unsupported', products: [], evidence: { status: 'no_evidence', sourceTypes: [], retrievedAt: new Date().toISOString() }, followUps: [] }
  if (!capabilityEnabled(config, intent)) return { requestId, ...capabilityDisabled(locale), products: [], evidence: { status: 'verified', sourceTypes: [], retrievedAt: new Date().toISOString() } }
  const retrieval = await retrieveAssistantContext(request.message, intent, request.pageContext?.productId, request.pageContext?.pathname, request.conversation)
  if (isAdminOrInternalRequest(request.message)) {
    const output = adminRefusal(locale)
    return { requestId, answer: output.answer, locale: output.locale, intent: output.intent, products: [], supportCta: supportCtaFor(config, retrieval), evidence: { status: 'verified', sourceTypes: retrieval.sources, retrievedAt: retrieval.retrievedAt }, followUps: output.followUps }
  }
  const providerOutput = !['greeting', 'thanks', 'goodbye', 'unsupported'].includes(intent) ? await callProvider(request, retrieval, intent, config) : null
  const modelOutput = providerOutput && safeModelOutput(providerOutput, intent, retrieval) ? providerOutput : null
  const output = modelOutput ?? deterministicFallback(request, retrieval, intent)
  const allowedIds = new Set(retrieval.context.map((item) => item.id))
  const safeIds = output.productIds.filter((id) => allowedIds.has(id)).slice(0, 6)
  const products = await hydrateProductReferences(safeIds)
  const finalOutput = products.length === safeIds.length ? output : { ...output, productIds: products.map((product) => product.id), evidenceStatus: products.length ? output.evidenceStatus : 'partial' as const }
  return { requestId, answer: finalOutput.answer, locale: finalOutput.locale, intent: finalOutput.intent, products, supportCta: supportCtaFor(config, retrieval), evidence: { status: finalOutput.evidenceStatus === 'verified' ? 'verified' : finalOutput.evidenceStatus === 'partial' ? 'partial' : 'no_evidence', sourceTypes: retrieval.sources, retrievedAt: retrieval.retrievedAt }, followUps: finalOutput.followUps }
}

export async function isAssistantProviderConfigured() {
  return Boolean(await resolveAssistantProviderConfig())
}

export async function testAssistantProviderConnection(input: { provider: string; apiUrl: string; apiKey: string; model: string }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(input.apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${input.apiKey}` }, body: JSON.stringify({ model: input.model, temperature: 0, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK.' }] }), signal: controller.signal, cache: 'no-store' })
    return response.ok ? { ok: true, message: 'Provider connection succeeded.' } : { ok: false, message: `Provider connection failed with HTTP ${response.status}.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.name === 'AbortError' ? 'Provider connection timed out.' : 'Provider connection failed.' }
  } finally {
    clearTimeout(timeout)
  }
}

export { getStorePolicy, getSupportCta }
