import 'server-only'

import { assistantModelOutputSchema, modelJsonSchema } from './contracts'
import type { AssistantModelOutput, AssistantRequest, AssistantResponse } from './contracts'
import {
  classifyIntent,
  getStorePolicy,
  hydrateProductReferences,
  isPrivateAssistantRequest,
  retrieveAssistantContext,
} from './retrieval'
import type { RetrievalResult } from './retrieval'
import { loadAssistantControlConfig } from './config'

const DEFAULT_FOLLOW_UPS = ['একটি পণ্য খুঁজে দিন', 'বাজেটের মধ্যে ফোন দেখান', 'ডেলিভারি সম্পর্কে জানতে চাই']

function providerConfig() {
  const apiUrl = process.env.ASSISTANT_LLM_API_URL?.trim()
  const apiKey = process.env.ASSISTANT_LLM_API_KEY?.trim()
  const model = process.env.ASSISTANT_LLM_MODEL?.trim()
  return apiUrl && apiKey && model ? { apiUrl, apiKey, model } : null
}

function requestedLocale(request: AssistantRequest): 'bn' | 'en' {
  if (request.locale === 'bn') return 'bn'
  if (request.locale === 'en') return 'en'
  return /[\u0980-\u09FF]/.test(request.message) ? 'bn' : 'en'
}

function formatBdt(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null
  return `৳${new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(value)}`
}

function deterministicOutput(request: AssistantRequest, retrieval: RetrievalResult, intent: ReturnType<typeof classifyIntent>): AssistantModelOutput {
  const locale = requestedLocale(request)
  const names = retrieval.context.slice(0, 3).map((item) => item.name)
  const first = retrieval.context[0]
  let answer: string
  let evidenceStatus: AssistantModelOutput['evidenceStatus'] = retrieval.context.length || retrieval.policyText ? 'verified' : 'no_evidence'
  let fallbackReason: AssistantModelOutput['fallbackReason'] = evidenceStatus === 'verified' ? 'none' : 'no_matching_products'

  if (isPrivateAssistantRequest(request.message)) {
    answer = locale === 'bn'
      ? 'আমি অর্ডার, গ্রাহক, পেমেন্ট বা অ্যাকাউন্টের ব্যক্তিগত তথ্য দেখতে পারি না। অর্ডার বা সহায়তার জন্য hello@sahigadget.shop অথবা +880 1601-654316-এ যোগাযোগ করুন।'
      : 'I cannot access private order, customer, payment, or account information. Please contact hello@sahigadget.shop or +880 1601-654316 for support.'
    evidenceStatus = 'verified'
    fallbackReason = 'private_request'
    return { answer, locale, intent: 'unsupported', productIds: [], evidenceStatus, fallbackReason, followUps: ['ডেলিভারি সম্পর্কে জানতে চাই', 'ওয়ারেন্টি সম্পর্কে জানতে চাই'] }
  }

  if (retrieval.policyText) {
    answer = locale === 'bn' ? retrieval.policyText : retrieval.policyText.replace('ঢাকার মধ্যে ডেলিভারি চার্জ', 'Delivery charge inside Dhaka').replace('এবং ঢাকার বাইরে', ' and outside Dhaka').replace('সহায়তার জন্য ফোন', 'For support call').replace('অথবা ইমেইল', 'or email')
    return { answer, locale, intent, productIds: [], evidenceStatus: 'verified', fallbackReason: 'none', followUps: ['একটি পণ্য খুঁজে দিন', 'বাজেটের মধ্যে ফোন দেখান'] }
  }

  if (!first) {
    answer = locale === 'bn' ? 'দুঃখিত, আপনার প্রশ্নের জন্য যাচাই করা তথ্য বা মিল পাওয়া পণ্য খুঁজে পাইনি। অন্যভাবে লিখে চেষ্টা করুন।' : 'I could not find verified information or a matching published product for that question. Please try another wording.'
    return { answer, locale, intent, productIds: [], evidenceStatus: 'no_evidence', fallbackReason, followUps: DEFAULT_FOLLOW_UPS }
  }

  const price = formatBdt(Math.min(...first.variants.map((variant) => variant.price)))
  const availability = first.variants.some((variant) => variant.isInStock) ? 'available' : 'currently unavailable'
  if (locale === 'bn') {
    if (intent === 'price') answer = `${first.name}-এর বর্তমান শুরু মূল্য ${price ?? 'নির্ধারণ করা যায়নি'}। ভ্যারিয়েন্টভেদে মূল্য পরিবর্তন হতে পারে।`
    else if (intent === 'availability') answer = `${first.name} বর্তমানে ${availability === 'available' ? 'উপলভ্য' : 'স্টকে নেই'}। নির্দিষ্ট ভ্যারিয়েন্ট নির্বাচন করার আগে লাইভ স্ট্যাটাস দেখুন।`
    else if (intent === 'variant') answer = `${first.name}-এর পাওয়া ভ্যারিয়েন্ট: ${first.variants.map((variant) => variant.title).filter(Boolean).join(', ') || 'ভ্যারিয়েন্ট তথ্য পাওয়া যায়নি'}।`
    else answer = `আপনার জন্য ${names.join(', ')} পাওয়া গেছে। লাইভ মূল্য, ছবি এবং প্রাপ্যতা দেখতে পণ্যটি খুলুন।`
  } else {
    if (intent === 'price') answer = `The current starting price for ${first.name} is ${price ?? 'not available'}. Price may vary by variant.`
    else if (intent === 'availability') answer = `${first.name} is ${availability}. Check the live status after selecting a specific variant.`
    else if (intent === 'variant') answer = `Available variants for ${first.name}: ${first.variants.map((variant) => variant.title).filter(Boolean).join(', ') || 'variant information is unavailable'}.`
    else answer = `I found ${names.join(', ')} for you. Open a product card to see its live price, image, and availability.`
  }
  return { answer, locale, intent, productIds: retrieval.context.slice(0, 3).map((item) => item.id), evidenceStatus, fallbackReason: 'none', followUps: DEFAULT_FOLLOW_UPS }
}

function buildPrompt(request: AssistantRequest, retrieval: RetrievalResult, intent: ReturnType<typeof classifyIntent>) {
  const context = JSON.stringify({ products: retrieval.context, policy: retrieval.policyText ?? null })
  return [
    'You are the SahiGadget public customer assistant.',
    'Answer primarily in Bengali when the customer uses Bengali. Use only the verified context below.',
    'Never invent facts. Never reveal private data. Never provide exact stock counts. Never claim that you created or checked an order.',
    'The only permitted productIds are IDs present in the verified product context.',
    `Detected intent: ${intent}`,
    `Customer message: ${request.message}`,
    `Verified context: ${context}`,
    'Return only the required JSON schema.',
  ].join('\n\n')
}

async function callProvider(request: AssistantRequest, retrieval: RetrievalResult, intent: ReturnType<typeof classifyIntent>): Promise<AssistantModelOutput | null> {
  const config = providerConfig()
  if (!config) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        max_tokens: 1400,
        messages: [
          { role: 'system', content: 'Output JSON only. Follow the schema exactly and ground every claim in the supplied context.' },
          { role: 'user', content: buildPrompt(request, retrieval, intent) },
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

function isSafeModelOutput(output: AssistantModelOutput, intent: ReturnType<typeof classifyIntent>, retrieval: RetrievalResult) {
  if (intent !== 'product_search' || output.intent !== 'product_search' || output.evidenceStatus === 'no_evidence' || output.fallbackReason !== 'none') return false
  if (!retrieval.context.length) return false
  if (/[৳₹$€]|\b\d{2,}\b|স্টক|স্টকে|available|availability|দাম|মূল্য|price|discount|ছাড়|ডেলিভারি|delivery|ওয়ারেন্টি|warranty|গ্যারান্টি|guarantee/i.test(output.answer)) return false
  return true
}

export async function buildAssistantResponse(request: AssistantRequest, requestId: string): Promise<AssistantResponse> {
  const config = await loadAssistantControlConfig()
  const intent = classifyIntent(request.message)
  const locale = requestedLocale(request)
  if (!config.enabled) return { requestId, answer: locale === 'bn' ? 'সহকারীটি বর্তমানে বন্ধ আছে।' : 'The assistant is currently unavailable.', locale, intent: 'unsupported', products: [], evidence: { status: 'no_evidence', sourceTypes: [], retrievedAt: new Date().toISOString() }, followUps: [] }
  if ((intent === 'policy' || intent === 'store_information') && !config.allowPolicyQuestions) return { requestId, answer: locale === 'bn' ? 'এই ধরনের প্রশ্নের উত্তর এখন সহকারী দিতে পারছে না।' : 'The assistant is not configured to answer this type of question right now.', locale, intent: 'unsupported', products: [], evidence: { status: 'no_evidence', sourceTypes: [], retrievedAt: new Date().toISOString() }, followUps: [] }
  if (intent === 'product_search' && !config.allowProductSearch) return { requestId, answer: locale === 'bn' ? 'পণ্য খোঁজার সুবিধাটি এখন সাময়িকভাবে বন্ধ আছে।' : 'Product search is temporarily unavailable.', locale, intent: 'unsupported', products: [], evidence: { status: 'no_evidence', sourceTypes: [], retrievedAt: new Date().toISOString() }, followUps: [] }
  const retrieval = await retrieveAssistantContext(request.message, intent, request.pageContext?.productId, request.pageContext?.pathname)
  const providerOutput = intent === 'product_search' && config.allowRecommendations && retrieval.context.length ? await callProvider(request, retrieval, intent) : null
  const modelOutput = providerOutput && isSafeModelOutput(providerOutput, intent, retrieval) ? providerOutput : null
  const output = modelOutput ?? deterministicOutput(request, retrieval, intent)
  const allowedIds = new Set(retrieval.context.map((item) => item.id))
  const safeIds = output.productIds.filter((id) => allowedIds.has(id)).slice(0, 6)
  const products = await hydrateProductReferences(safeIds)
  const finalOutput = products.length === safeIds.length ? output : { ...output, productIds: products.map((product) => product.id), evidenceStatus: products.length ? output.evidenceStatus : 'no_evidence' as const }
  const answer = finalOutput.evidenceStatus === 'no_evidence' && finalOutput.intent !== 'unsupported'
    ? (requestedLocale(request) === 'bn' ? 'দুঃখিত, এই বিষয়ে যাচাই করা তথ্য পাওয়া যাচ্ছে না। অন্যভাবে লিখে চেষ্টা করুন অথবা hello@sahigadget.shop-এ যোগাযোগ করুন।' : 'I could not verify that information. Please try another wording or contact hello@sahigadget.shop.')
    : finalOutput.answer
  return {
    requestId,
    answer,
    locale: finalOutput.locale,
    intent: finalOutput.intent,
    products,
    evidence: { status: finalOutput.evidenceStatus === 'verified' ? 'verified' : finalOutput.evidenceStatus === 'partial' ? 'partial' : 'no_evidence', sourceTypes: retrieval.sources, retrievedAt: retrieval.retrievedAt },
    followUps: finalOutput.followUps,
  }
}

export function isAssistantProviderConfigured() {
  return Boolean(providerConfig())
}

export { getStorePolicy }
