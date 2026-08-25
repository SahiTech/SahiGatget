import 'server-only'

import { assistantModelOutputSchema, modelJsonSchema } from './contracts'
import type { AssistantModelOutput, AssistantRequest, AssistantResponse } from './contracts'
import {
  classifyIntent,
  getStorePolicy,
  hydrateProductReferences,
  isPrivateAssistantRequest,
  isFrustratedAssistantRequest,
  retrieveAssistantContext,
} from './retrieval'
import type { RetrievalResult } from './retrieval'
import { loadAssistantControlConfig, resolveAssistantProviderConfig } from './config'

const DEFAULT_FOLLOW_UPS = ['একটি পণ্য খুঁজে দিন', 'বাজেটের মধ্যে ফোন দেখান', 'ডেলিভারি সম্পর্কে জানতে চাই']

async function providerConfig() {
  return resolveAssistantProviderConfig()
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

  if (intent === 'greeting') {
    answer = locale === 'bn' ? 'হ্যালো! SahiGadget-এ স্বাগতম। কীভাবে সাহায্য করতে পারি? ফোন, বাজেট, পণ্য, অর্ডার বা ডেলিভারি সম্পর্কে জিজ্ঞেস করুন।' : 'Hello! Welcome to SahiGadget. How can I help with products, budgets, orders, or delivery today?'
    return { answer, locale, intent, productIds: [], evidenceStatus: 'verified', fallbackReason: 'none', followUps: DEFAULT_FOLLOW_UPS }
  }
  if (intent === 'thanks') {
    answer = locale === 'bn' ? 'আপনাকে স্বাগতম। আরও কিছু জানতে চাইলে বলুন।' : 'You’re welcome. Let me know if you need anything else.'
    return { answer, locale, intent, productIds: [], evidenceStatus: 'verified', fallbackReason: 'none', followUps: DEFAULT_FOLLOW_UPS }
  }
  if (intent === 'goodbye') {
    answer = locale === 'bn' ? 'বিদায়! SahiGadget-এর জন্য শুভকামনা রইল।' : 'Goodbye! Thank you for visiting SahiGadget.'
    return { answer, locale, intent, productIds: [], evidenceStatus: 'verified', fallbackReason: 'none', followUps: [] }
  }
  if (intent === 'clarification_required') {
    answer = locale === 'bn' ? 'অবশ্যই। আপনি কি কোনো পণ্য খুঁজছেন, নাকি অর্ডার ও ডেলিভারি সম্পর্কে জানতে চাইছেন?' : 'Sure. Are you looking for a product, or do you need help with ordering and delivery?'
    return { answer, locale, intent, productIds: [], evidenceStatus: 'partial', fallbackReason: 'ambiguous_request', followUps: DEFAULT_FOLLOW_UPS }
  }
  if (intent === 'support' && isFrustratedAssistantRequest(request.message)) {
    answer = locale === 'bn' ? 'দুঃখিত, আমি বিষয়টি ঠিকভাবে ধরতে পারিনি। সরাসরি Customer Service Team-এর সাথে WhatsApp-এ কথা বলুন—তারা আপনাকে সাহায্য করবে।' : 'Sorry, I did not understand the issue correctly. Please speak with our Customer Service Team on WhatsApp for help.'
    return { answer, locale, intent, productIds: [], evidenceStatus: 'verified', fallbackReason: 'none', followUps: [] }
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
  const description = first.description.replace(/\s+/g, ' ').trim().slice(0, 260)
  const variantSummary = first.variants.map((variant) => [variant.title, variant.ram, variant.storage].filter(Boolean).join(' · ')).filter(Boolean).join(', ')
  if (locale === 'bn') {
    if (intent === 'product_comparison' && retrieval.context.length > 1) {
      answer = `তুলনা করতে ${retrieval.context.slice(0, 3).map((item) => `${item.name} (${formatBdt(Math.min(...item.variants.map((variant) => variant.price))) ?? 'মূল্য যাচাই করুন'})`).join(' এবং ')} পাওয়া গেছে। প্রথমটি কম দামের দিকে এগিয়ে, তবে আপনার প্রয়োজন অনুযায়ী লাইভ স্পেসিফিকেশন ও স্টক দেখে বেছে নিন।`
    } else if (intent === 'price') answer = `${first.name}-এর বর্তমান শুরু মূল্য ${price ?? 'নির্ধারণ করা যায়নি'}। ভ্যারিয়েন্টভেদে মূল্য পরিবর্তন হতে পারে।`
    else if (intent === 'availability') answer = `${first.name} বর্তমানে ${availability === 'available' ? 'উপলভ্য' : 'স্টকে নেই'}। নির্দিষ্ট ভ্যারিয়েন্ট নির্বাচন করার আগে লাইভ স্ট্যাটাস দেখুন।`
    else if (intent === 'variant') answer = `${first.name}-এর পাওয়া ভ্যারিয়েন্ট: ${variantSummary || 'ভ্যারিয়েন্ট তথ্য পাওয়া যায়নি'}।`
    else if (intent === 'product_detail' && description) answer = `${first.name}: ${description}${first.description.length > description.length ? '…' : ''}`
    else answer = `আপনার জন্য ${names.join(', ')} পাওয়া গেছে। লাইভ মূল্য, ছবি এবং প্রাপ্যতা দেখতে পণ্যটি খুলুন।`
  } else {
    if (intent === 'product_comparison' && retrieval.context.length > 1) {
      answer = `I found ${retrieval.context.slice(0, 3).map((item) => `${item.name} (${formatBdt(Math.min(...item.variants.map((variant) => variant.price))) ?? 'price unavailable'})`).join(' and ')}. The first option is lower-priced, but compare the live specifications and stock for your use case before choosing.`
    } else if (intent === 'price') answer = `The current starting price for ${first.name} is ${price ?? 'not available'}. Price may vary by variant.`
    else if (intent === 'availability') answer = `${first.name} is ${availability}. Check the live status after selecting a specific variant.`
    else if (intent === 'variant') answer = `Available variants for ${first.name}: ${variantSummary || 'variant information is unavailable'}.`
    else if (intent === 'product_detail' && description) answer = `${first.name}: ${description}${first.description.length > description.length ? '…' : ''}`
    else answer = `I found ${names.join(', ')} for you. Open a product card to see its live price, image, and availability.`
  }
  return { answer, locale, intent, productIds: retrieval.context.slice(0, 3).map((item) => item.id), evidenceStatus, fallbackReason: 'none', followUps: DEFAULT_FOLLOW_UPS }
}

function buildPrompt(request: AssistantRequest, retrieval: RetrievalResult, intent: ReturnType<typeof classifyIntent>) {
  const context = JSON.stringify({ products: retrieval.context, policy: retrieval.policyText ?? null })
  const conversation = JSON.stringify((request.conversation ?? []).slice(-6))
  return [
    'You are the SahiGadget public customer assistant and sales-support representative.',
    'Answer naturally in Bengali for Bengali or Banglish customers, and in English when the customer clearly prefers English.',
    'Use only the verified context below for product, price, stock, specification, warranty, policy, or delivery claims. Current store data always wins over general knowledge.',
    'Never invent facts, prices, products, stock, specifications, warranty terms, delivery estimates, or policy. Never reveal private data or claim that you created or checked an order.',
    'Use the recent public conversation only to resolve references such as “এর মধ্যে”, “এটা”, “this phone”, or “which one”. Do not request or infer sensitive personal information.',
    'The only permitted productIds are IDs present in the verified product context.',
    `Detected intent: ${intent}`,
    `Customer message: ${request.message}`,
    `Recent conversation: ${conversation}`,
    `Verified context: ${context}`,
    'Keep simple answers concise, explain useful trade-offs for recommendations, and return only the required JSON schema.',
  ].join('\n\n')
}

async function callProvider(request: AssistantRequest, retrieval: RetrievalResult, intent: ReturnType<typeof classifyIntent>, controls: Awaited<ReturnType<typeof loadAssistantControlConfig>>): Promise<AssistantModelOutput | null> {
  const config = await providerConfig()
  if (!config) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), controls.requestTimeoutMs)
  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: controls.temperature,
        max_tokens: controls.maxTokens,
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
  const groundedIntents = new Set(['product_search', 'product_detail', 'product_comparison', 'product_recommendation', 'budget_search', 'price', 'availability', 'variant'])
  const conversationalIntents = new Set(['general_knowledge', 'casual_conversation'])
  const intentMatches = output.intent === intent || (intent === 'unclear' && groundedIntents.has(output.intent))
  if (!intentMatches || output.fallbackReason !== 'none') return false
  if (conversationalIntents.has(output.intent)) return output.productIds.length === 0 && output.evidenceStatus !== 'verified'
  if (!groundedIntents.has(output.intent) || output.evidenceStatus === 'no_evidence' || !retrieval.context.length) return false
  const allowedIds = new Set(retrieval.context.map((item) => item.id))
  return output.productIds.every((id) => allowedIds.has(id)) && output.productIds.length > 0
}

export async function buildAssistantResponse(request: AssistantRequest, requestId: string): Promise<AssistantResponse> {
  const config = await loadAssistantControlConfig()
  const intent = classifyIntent(request.message)
  const locale = requestedLocale(request)
  if (!config.enabled) return { requestId, answer: locale === 'bn' ? 'সহকারীটি বর্তমানে বন্ধ আছে।' : 'The assistant is currently unavailable.', locale, intent: 'unsupported', products: [], evidence: { status: 'no_evidence', sourceTypes: [], retrievedAt: new Date().toISOString() }, followUps: [] }
  if ((intent === 'policy' || intent === 'store_information') && !config.allowPolicyQuestions) return { requestId, answer: locale === 'bn' ? 'এই ধরনের প্রশ্নের উত্তর এখন সহকারী দিতে পারছে না।' : 'The assistant is not configured to answer this type of question right now.', locale, intent: 'unsupported', products: [], evidence: { status: 'no_evidence', sourceTypes: [], retrievedAt: new Date().toISOString() }, followUps: [] }
  if (intent === 'product_search' && !config.allowProductSearch) return { requestId, answer: locale === 'bn' ? 'পণ্য খোঁজার সুবিধাটি এখন সাময়িকভাবে বন্ধ আছে।' : 'Product search is temporarily unavailable.', locale, intent: 'unsupported', products: [], evidence: { status: 'no_evidence', sourceTypes: [], retrievedAt: new Date().toISOString() }, followUps: [] }
  const retrieval = await retrieveAssistantContext(request.message, intent, request.pageContext?.productId, request.pageContext?.pathname, request.conversation)
  const providerEligible = intent === 'general_knowledge' || intent === 'casual_conversation' || config.allowRecommendations
  const providerOutput = !['unsupported', 'policy', 'store_information', 'greeting', 'thanks', 'goodbye', 'clarification_required'].includes(intent) && providerEligible && (retrieval.context.length || intent === 'general_knowledge' || intent === 'casual_conversation') ? await callProvider(request, retrieval, intent, config) : null
  const modelOutput = providerOutput && isSafeModelOutput(providerOutput, intent, retrieval) ? providerOutput : null
  const output = modelOutput ?? deterministicOutput(request, retrieval, intent)
  const allowedIds = new Set(retrieval.context.map((item) => item.id))
  const safeIds = output.productIds.filter((id) => allowedIds.has(id)).slice(0, 6)
  const products = await hydrateProductReferences(safeIds)
  const finalOutput = products.length === safeIds.length ? output : { ...output, productIds: products.map((product) => product.id), evidenceStatus: products.length ? output.evidenceStatus : 'no_evidence' as const }
  const answer = finalOutput.evidenceStatus === 'no_evidence' && !['unsupported', 'general_knowledge', 'casual_conversation'].includes(finalOutput.intent)
    ? (requestedLocale(request) === 'bn' ? 'দুঃখিত, এই বিষয়ে নিশ্চিত তথ্য পাওয়া যাচ্ছে না। চাইলে Customer Service-এর সাথে সরাসরি যোগাযোগ করুন।' : 'I could not verify that information. You can contact Customer Service directly for help.')
    : finalOutput.answer
  return {
    requestId,
    answer,
    locale: finalOutput.locale,
    intent: finalOutput.intent,
    products,
    supportCta: retrieval.supportCta,
    evidence: { status: finalOutput.evidenceStatus === 'verified' ? 'verified' : finalOutput.evidenceStatus === 'partial' ? 'partial' : 'no_evidence', sourceTypes: retrieval.sources, retrievedAt: retrieval.retrievedAt },
    followUps: finalOutput.followUps,
  }
}

export async function isAssistantProviderConfigured() {
  return Boolean(await providerConfig())
}

export async function testAssistantProviderConnection(input: { provider: string; apiUrl: string; apiKey: string; model: string }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(input.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${input.apiKey}` },
      body: JSON.stringify({ model: input.model, temperature: 0, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK.' }] }),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) return { ok: false, message: `Provider connection failed with HTTP ${response.status}.` }
    return { ok: true, message: 'Provider connection succeeded.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.name === 'AbortError' ? 'Provider connection timed out.' : 'Provider connection failed.' }
  } finally {
    clearTimeout(timeout)
  }
}

export { getStorePolicy }
