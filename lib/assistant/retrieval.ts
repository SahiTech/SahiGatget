import 'server-only'

import { siteConfig } from '@/config/site'
import {
  getProductById,
  getProductBySlug,
  getProducts,
  getStorefrontSettings,
} from '@/lib/services/storefront'
import {
  getProductDescription,
  getProductImageAlt,
  getProductPrimaryImage,
  getProductPath,
  getProductAvailability,
  getStartingPrice,
  getCompareAtPrice,
} from '@/lib/services/storefront-utils'
import type { StorefrontProduct } from '@/lib/services/storefront-utils'
import type { AssistantIntent } from './contracts'
import type { PublicProductCard } from './contracts'
import { loadAssistantPolicyConfig } from './config'

export type RetrievedSource = 'live_product' | 'live_variant' | 'public_policy' | 'site_config'

export type PublicProductContext = {
  id: string
  name: string
  slug: string
  shortDescription: string | null
  description: string
  productType: string
  brand: string | null
  category: string | null
  warrantyPolicy: string | null
  variants: Array<{
    id: string
    title: string
    ram: string | null
    storage: string | null
    color: string | null
    price: number
    compareAtPrice: number | null
    isInStock: boolean
    isLowStock: boolean
  }>
}

export type RetrievalResult = {
  context: PublicProductContext[]
  sources: RetrievedSource[]
  retrievedAt: string
  policyText?: string
  supportCta?: { label: string; href: string }
}

const MAX_RESULTS = 6

function isPrivateRequest(message: string) {
  const normalized = message.trim()
  const explicitPrivateEnglish = /\b(?:another|other|someone\s+else'?s|someone\s+elses|different)\s+(?:customer|user|person)'?s?\s+(?:order|invoice|payment|phone|address|account|information|details)\b|\b(?:show|give|tell|reveal|share|access|view)\b[^\n]{0,80}\b(?:another customer|someone else|admin password|api key|secret credentials?|private (?:order|payment|account|customer) information)\b|\b(?:admin password|api key|secret credentials?|private (?:order|payment|account|customer) information)\b/i.test(normalized)
  const explicitPrivateBangla = /অন্য\s*(?:গ্রাহক|কাস্টমার|customer|ব্যক্তি)[^\n]{0,80}(?:অর্ডার|order|ইনভয়েস|invoice|পেমেন্ট|payment|ফোন|phone|ঠিকানা|address|অ্যাকাউন্ট|account|তথ্য)|(?:অ্যাডমিন|এডমিন)\s*পাসওয়ার্ড|এপিআই\s*কি|API\s*key|গোপন\s*(?:ক্রেডেনশিয়াল|তথ্য)|অন্যের\s*(?:অর্ডার|পেমেন্ট|ঠিকানা|অ্যাকাউন্ট)/i.test(normalized)
  const privateOrderLookup = /\bmy\s+(?:order|invoice|payment|tracking|track|refund|cancel)\b/i.test(normalized) && /\b(?:status|details|show|where|track)\b/i.test(normalized)
  const privateOrderLookupBangla = /আমার\s*(?:অর্ডার|ইনভয়েস|পেমেন্ট|ট্র্যাকিং|রিফান্ড|বাতিল)[^\n]{0,40}(?:অবস্থা|বিস্তারিত|দেখাও|দেখান|কোথায়|কোথায়|ট্র্যাক)/i.test(normalized)
  const privateOrderLookupMixed = /আমার\s*(?:order|invoice|payment|tracking|track|refund|cancel)[^\n]{0,60}(?:phone|number|address|details|status|show|where|track|নম্বর|ফোন|ঠিকানা|বিস্তারিত|অবস্থা)/i.test(normalized)
  return explicitPrivateEnglish || explicitPrivateBangla || privateOrderLookup || privateOrderLookupBangla || privateOrderLookupMixed
}

function toEnglishDigits(value: string) {
  const map: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' }
  return value.replace(/[০-৯]/g, (digit) => map[digit] ?? digit)
}

export function extractBudget(message: string) {
  const normalized = toEnglishDigits(message).replace(/,/g, '')
  const thousands = normalized.match(/(\d{1,3})\s*হাজার/i)
  if (thousands) {
    const value = Number(thousands[1]) * 1000
    return Number.isFinite(value) && value > 0 && value <= 10000000 ? Math.floor(value) : undefined
  }
  const match = normalized.match(/(?:under|within|below|budget|max|less than|৳|tk|taka|টাকা)\s*(\d{2,7})/i) ?? normalized.match(/(\d{2,7})\s*(?:taka|tk|৳|টাকা)/i)
  if (!match) return undefined
  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 && value <= 10000000 ? Math.floor(value) : undefined
}

function toContext(product: StorefrontProduct): PublicProductContext {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.short_description,
    description: getProductDescription(product),
    productType: product.product_type,
    brand: product.brand?.name ?? null,
    category: product.category?.name ?? null,
    warrantyPolicy: product.warranty_policy,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      title: variant.variant_title,
      ram: variant.ram,
      storage: variant.storage,
      color: variant.color,
      price: variant.price,
      compareAtPrice: variant.compare_at_price,
      isInStock: variant.is_in_stock,
      isLowStock: variant.is_low_stock,
    })),
  }
}

function getProductCard(product: StorefrontProduct): PublicProductCard {
  const availability = getProductAvailability(product)
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    imageUrl: getProductPrimaryImage(product),
    imageAlt: getProductImageAlt(product),
    price: getStartingPrice(product),
    compareAtPrice: getCompareAtPrice(product),
    availability: availability.tone === 'in' ? 'in_stock' : availability.tone === 'low' ? 'low_stock' : 'out_of_stock',
    href: getProductPath(product.slug),
  }
}

export async function searchProducts(input: { query?: string; maxPrice?: number; onlyAvailable?: boolean; limit?: number }) {
  const limit = Math.min(Math.max(input.limit ?? 4, 1), MAX_RESULTS)
  const result = await getProducts({
    query: input.query?.trim().slice(0, 160),
    maxPrice: input.maxPrice,
    availability: input.onlyAvailable ? 'in-stock' : 'all',
    pageSize: limit,
    page: 1,
    sort: 'newest',
  })
  return result.products.slice(0, limit)
}

export async function getProduct(input: { productId?: string; slug?: string }) {
  if (input.productId) return getProductById(input.productId)
  if (input.slug) return getProductBySlug(input.slug)
  return null
}

export async function getProductVariants(input: { productId: string }) {
  const product = await getProductById(input.productId)
  return product?.variants ?? []
}

export async function getAvailableProducts(input: { query?: string; maxPrice?: number; limit?: number }) {
  return searchProducts({ ...input, onlyAvailable: true })
}

export async function getStorePolicy(topic: 'delivery' | 'delivery_charge' | 'warranty' | 'returns' | 'cod' | 'order' | 'support' | 'store_information', product?: StorefrontProduct | null) {
  const [settings, overrides] = await Promise.all([getStorefrontSettings(), loadAssistantPolicyConfig()])
  const delivery = `ঢাকার মধ্যে ডেলিভারি চার্জ ${siteConfig.currency.symbol}${settings.delivery.dhakaCharge} এবং ঢাকার বাইরে ${siteConfig.currency.symbol}${settings.delivery.outsideDhakaCharge}। ডেলিভারি সময় লোকেশন, কুরিয়ার, আবহাওয়া, ছুটির দিন, ঠিকানা এবং অর্ডার যাচাইয়ের উপর নির্ভর করতে পারে।`
  const defaultWarranty = `${settings.warranty.guaranteeDays} দিনের গ্যারান্টি এবং ${settings.warranty.serviceWarrantyYears} বছরের সার্ভিস ওয়ারেন্টি প্রযোজ্য হতে পারে। পণ্যের নির্দিষ্ট ওয়ারেন্টি নীতি এবং প্রস্তুতকারকের শর্ত অগ্রাধিকার পাবে।`
  const productWarranty = product?.warranty_policy?.trim()
  const warranty = productWarranty || defaultWarranty
  const returns = 'পণ্য বা ডেলিভারি-সংক্রান্ত সমস্যা থাকলে গ্রহণের পর যুক্তিসঙ্গত সময়ের মধ্যে এবং সাধারণত ৭ দিনের মধ্যে SahiGadget-কে জানাতে হবে। ছবি, ভিডিও, অর্ডার ও পণ্যের তথ্য যাচাইয়ের জন্য প্রয়োজন হতে পারে। যাচাই ছাড়া স্বয়ংক্রিয় রিফান্ড বা রিপ্লেসমেন্টের নিশ্চয়তা নেই; রিপ্লেসমেন্ট পণ্য ও স্টকের প্রাপ্যতার উপর নির্ভর করতে পারে।'
  const cod = settings.footer.payments.cash_on_delivery ? 'বর্তমান SahiGadget চেকআউটে Cash on Delivery পাওয়া যেতে পারে। অর্ডার নিশ্চিত করার আগে বিদ্যমান চেকআউটের যাচাই ও শর্ত প্রযোজ্য হবে।' : 'বর্তমান প্রকাশ্য তথ্য অনুযায়ী Cash on Delivery নিশ্চিত করা যাচ্ছে না।'
  const order = 'অর্ডার করতে প্রথমে লাইভ ক্যাটালগ থেকে পণ্য, রঙ, RAM ও স্টোরেজ ভ্যারিয়েন্ট বেছে নিন। এরপর নাম, মোবাইল নম্বর ও সম্পূর্ণ ডেলিভারি ঠিকানা দিন, মোট মূল্য ও ডেলিভারি চার্জ যাচাই করে Cash on Delivery অর্ডার নিশ্চিত করুন। কুরিয়ার পণ্য পৌঁছে দিলে গ্রহণের সময় নগদ মূল্য পরিশোধ করুন।'
  const support = `সহায়তার জন্য ফোন ${siteConfig.contact.phone} অথবা ইমেইল ${siteConfig.contact.supportEmail} ব্যবহার করুন।`
  const store = `${siteConfig.name} বাংলাদেশে মোবাইল ফোন ও গ্যাজেট সরবরাহ করে। সাধারণ সহায়তার জন্য ${siteConfig.contact.supportEmail} অথবা ${siteConfig.contact.phone} ব্যবহার করুন।`
  const overrideMap: Record<typeof topic, string> = {
    delivery: overrides.delivery,
    delivery_charge: overrides.delivery,
    warranty: overrides.warranty,
    returns: overrides.returns,
    cod: overrides.cod,
    order: '',
    support: overrides.support,
    store_information: overrides.storeInformation,
  }
  const map: Record<typeof topic, string> = { delivery, delivery_charge: delivery, warranty, returns, cod, order, support, store_information: store }
  const selectedOverride = overrideMap[topic]?.trim()
  const sources: RetrievedSource[] = selectedOverride
    ? ['public_policy']
    : topic === 'support' || topic === 'store_information'
      ? ['site_config']
      : ['public_policy']
  return { topic, text: selectedOverride || map[topic], settings, sources }
}

export async function hydrateProductReferences(productIds: string[]) {
  const uniqueIds = Array.from(new Set(productIds)).slice(0, MAX_RESULTS)
  const products = await Promise.all(uniqueIds.map((id) => getProductById(id).catch(() => null)))
  return products.filter((product): product is StorefrontProduct => Boolean(product)).map(getProductCard)
}

export function getSupportCta() {
  const digits = siteConfig.contact.phone.replace(/\D/g, '')
  const normalized = digits.startsWith('0') ? `880${digits.slice(1)}` : digits.startsWith('880') ? digits : `880${digits}`
  return { label: 'WhatsApp Customer Service', href: `https://wa.me/${normalized}` }
}

export function classifyIntent(message: string): AssistantIntent {
  const normalized = message.trim()
  if (isPrivateRequest(normalized)) return 'unsupported'
  if (/^(?:hi|hello|hey|হ্যালো|হাই|আসসালামু\s+আলাইকুম|সালাম|good\s+(?:morning|afternoon|evening)|কেমন\s+আছেন)(?:[\s,!?.]+.*)?$/i.test(normalized)) return 'greeting'
  if (/^(?:thanks|thank\s+you|ধন্যবাদ|অনেক\s+ধন্যবাদ)\W*$/i.test(normalized)) return 'thanks'
  if (/^(?:bye|goodbye|see\s+you|বিদায়|আবার\s+দেখা\s+হবে)\W*$/i.test(normalized)) return 'goodbye'
  if (/^(?:how are you|আমি শুধু দেখছি|just browsing|আচ্ছা|ঠিক আছে)\W*$/i.test(normalized)) return 'casual_conversation'
  if (/customer\s*service|human\s+support|talk\s+to\s+(?:a\s+)?(?:human|person|someone)|support\s+(?:please|help)|whatsapp|আপনি\s+বুঝতে\s+পারছেন\s+না|বারবার\s+একই|কাজ\s+হচ্ছে\s+না|ভুল\s+তথ্য|you\s+don'?t\s+understand|same\s+thing|not\s+working|wrong\s+(?:information|answer)|কাস্টমার\s*সার্ভিস|মানুষের\s+সাথে|সাপোর্ট|হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ/i.test(normalized)) return 'support'
  if (/delivery|ঢাকা|ডেলিভারি|কুরিয়ার|charge|চার্জ|\border\b|অর্ডার/i.test(normalized)) return 'policy'
  if (/warranty|guarantee|ওয়ারেন্টি|গ্যারান্টি|returns?|রিটার্ন|রিপ্লেস|COD|cash on delivery|ক্যাশ অন ডেলিভারি|payment|পেমেন্ট|অর্ডার করার পদ্ধতি|how to order/i.test(normalized)) return 'policy'
  if (extractBudget(normalized) || /(?:under|within|below|budget|max|less than|বাজেটের মধ্যে)/i.test(normalized)) return 'budget_search'
  if (/comparison|compare|তুলনা|দুটোর মধ্যে|দুইটার মধ্যে|vs\.?/i.test(normalized)) return 'product_comparison'
  if (/(?:recommend|best|better|ভালো|সেরা|জন্য ভালো|কোনটা নেব)/i.test(normalized) && /phone|mobile|ফোন|মোবাইল|camera|ক্যামেরা|battery|ব্যাটারি|দাম|price/i.test(normalized)) return 'product_recommendation'
  if (/price|দাম|মূল্য|৳|tk|টাকা/i.test(normalized)) return 'price'
  if (/stock|available|availability|স্টক|অ্যাভেইল|প্রাপ্য/i.test(normalized)) return 'availability'
  if (/(?:\bwhat\s+is\b|\bwhy\b|\bhow\b|\bwhen\b|\bwhere\b|\bwho\b|\bexplain\b|\bdefine\b|কী|কেন|কীভাবে|কখন|কোথায়|কোথায়|ব্যাখ্যা)/i.test(normalized) && !/(?:\b(?:this|that|my)\s+(?:phone|mobile|device)\b|(?:এই|এটা|ওটা|আমার)\s*(?:ফোন|মোবাইল|ডিভাইস))/i.test(normalized) && !/price|দাম|মূল্য|camera|ক্যামেরা|battery|ব্যাটারি|processor|প্রসেসর/i.test(normalized)) return 'general_knowledge'
  if (/variant|color|colour|ram|storage|রঙ|কালার|ভ্যারিয়েন্ট|স্টোরেজ|র‍্যাম/i.test(normalized)) return 'variant'
  if (/details|spec|camera|battery|processor|display|চার্জার|ক্যামেরা|ব্যাটারি|প্রসেসর|ডিসপ্লে|বিস্তারিত|স্পেসিফিকেশন|কী কী/i.test(normalized)) return 'product_detail'
  if (/(?:এর মধ্যে|এটা|এটির|এটার|ওটার|ওটা|এই ফোন|কোনটা|কোনটি)|\b(?:which one|which is better|this phone|this one|that one|these|those|it)\b/i.test(normalized)) return 'product_search'
  if (/show|find|দেখান|খুঁজে|phone|mobile|ফোন|মোবাইল/i.test(normalized) || (/চাই/i.test(normalized) && /পণ্য|ফোন|মোবাইল|device|product/i.test(normalized))) return 'product_search'
  if (/store|shop|contact|support|ঠিকানা|যোগাযোগ|সাহিগ্যাজেট|sahigadget/i.test(normalized)) return 'store_information'
  return 'clarification_required'
}

type ConversationTurn = { role: 'user' | 'assistant'; content: string; productIds?: string[] }

function referencedProductIds(message: string, conversation?: ConversationTurn[]) {
  if (!conversation?.length || !/(?:এর মধ্যে|এটা|এটির|এটার|ওটার|ওটা|এই ফোন|কোনটা|কোনটি)|\b(?:which one|this phone|this one|that one|these|those|it)\b/i.test(message)) return []
  return Array.from(new Set(conversation.slice().reverse().flatMap((turn) => turn.productIds ?? []))).slice(0, MAX_RESULTS)
}

export async function retrieveAssistantContext(message: string, intent: AssistantIntent, pageProductId?: string, pagePathname?: string, conversation?: ConversationTurn[]): Promise<RetrievalResult> {
  const retrievedAt = new Date().toISOString()
  if (intent === 'unsupported') return { context: [], sources: [], retrievedAt, supportCta: getSupportCta() }
  if (['greeting', 'casual_conversation', 'thanks', 'goodbye', 'general_knowledge', 'clarification_required'].includes(intent)) return { context: [], sources: [], retrievedAt, supportCta: intent === 'clarification_required' ? getSupportCta() : undefined }
  const pageSlug = pagePathname?.match(/^\/products\/([^/?#]+)$/)?.[1]
  const pageProduct = pageProductId
    ? await getProductById(pageProductId).catch(() => null)
    : pageSlug
      ? await getProductBySlug(decodeURIComponent(pageSlug)).catch(() => null)
      : null
  if (intent === 'policy' || intent === 'store_information' || intent === 'support') {
    const topic = intent === 'support' ? 'support' : /কিভাবে\s*অর্ডার|অর্ডার\s*(?:করব|করতে|করার)|how to order|order process/i.test(message) ? 'order' : /warranty|guarantee|ওয়ারেন্টি|গ্যারান্টি/i.test(message) ? 'warranty' : /return|রিটার্ন|রিপ্লেস/i.test(message) ? 'returns' : /cod|cash|ক্যাশ|payment|পেমেন্ট/i.test(message) ? 'cod' : /delivery|ঢাকা|ডেলিভারি|চার্জ|\bwhen\b|\bhow many days\b|\bget it\b|কতদিন|কবে|পাবো|দিনের মধ্যে|সময়/i.test(message) ? 'delivery' : /support|contact|যোগাযোগ|ইমেইল|ফোন/i.test(message) ? 'support' : 'store_information'
    const policy = await getStorePolicy(topic, pageProduct)
    return { context: [], sources: policy.sources, retrievedAt, policyText: policy.text, supportCta: intent === 'support' ? getSupportCta() : undefined }
  }
  const budget = extractBudget(message)
  const referencedIds = referencedProductIds(message, conversation)
  const referencedProducts = referencedIds.length ? (await Promise.all(referencedIds.map((id) => getProductById(id).catch(() => null)))).filter((product): product is StorefrontProduct => Boolean(product)) : []
  const products = pageProduct && intent !== 'product_search'
    ? [pageProduct]
    : referencedProducts.length
      ? referencedProducts
      : await searchProducts({ query: budget ? undefined : message, maxPrice: budget, onlyAvailable: intent === 'availability', limit: MAX_RESULTS })
  const context = products.map(toContext)
  return { context, sources: context.length ? ['live_product', 'live_variant'] : [], retrievedAt, supportCta: context.length ? undefined : getSupportCta() }
}

export function toPublicCard(product: StorefrontProduct): PublicProductCard {
  return getProductCard(product)
}

export function isPrivateAssistantRequest(message: string) {
  return isPrivateRequest(message)
}

export function isFrustratedAssistantRequest(message: string) {
  return /আপনি\s+বুঝতে\s+পারছেন\s+না|বারবার\s+একই|কাজ\s+হচ্ছে\s+না|ভুল\s+তথ্য|you\s+don'?t\s+understand|same\s+thing|not\s+working|wrong\s+(?:information|answer)/i.test(message)
}
