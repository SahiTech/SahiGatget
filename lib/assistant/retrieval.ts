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
}

const MAX_RESULTS = 6

function isPrivateRequest(message: string) {
  return /\b(order|invoice|payment|refund|cancel|tracking|track|customer|account|address|password|otp|login|auth|imei|serial)\b/i.test(message) || /অর্ডার|ইনভয়েস|পেমেন্ট|রিফান্ড|বাতিল|ট্র্যাক|গ্রাহক|অ্যাকাউন্ট|ঠিকানা|পাসওয়ার্ড|ওটিপি|লগইন|আইএমইআই|সিরিয়াল/.test(message)
}

function toEnglishDigits(value: string) {
  const map: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' }
  return value.replace(/[০-৯]/g, (digit) => map[digit] ?? digit)
}

export function extractBudget(message: string) {
  const normalized = toEnglishDigits(message).replace(/,/g, '')
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

export async function getStorePolicy(topic: 'delivery' | 'delivery_charge' | 'warranty' | 'returns' | 'cod' | 'support' | 'store_information', product?: StorefrontProduct | null) {
  const settings = await getStorefrontSettings()
  const delivery = `ঢাকার মধ্যে ডেলিভারি চার্জ ${siteConfig.currency.symbol}${settings.delivery.dhakaCharge} এবং ঢাকার বাইরে ${siteConfig.currency.symbol}${settings.delivery.outsideDhakaCharge}। ডেলিভারি সময় লোকেশন, কুরিয়ার, আবহাওয়া, ছুটির দিন, ঠিকানা এবং অর্ডার যাচাইয়ের উপর নির্ভর করতে পারে।`
  const defaultWarranty = `${settings.warranty.guaranteeDays} দিনের গ্যারান্টি এবং ${settings.warranty.serviceWarrantyYears} বছরের সার্ভিস ওয়ারেন্টি প্রযোজ্য হতে পারে। পণ্যের নির্দিষ্ট ওয়ারেন্টি নীতি এবং প্রস্তুতকারকের শর্ত অগ্রাধিকার পাবে।`
  const productWarranty = product?.warranty_policy?.trim()
  const warranty = productWarranty || defaultWarranty
  const returns = 'পণ্য বা ডেলিভারি-সংক্রান্ত সমস্যা থাকলে গ্রহণের পর যুক্তিসঙ্গত সময়ের মধ্যে এবং সাধারণত ৭ দিনের মধ্যে SahiGadget-কে জানাতে হবে। ছবি, ভিডিও, অর্ডার ও পণ্যের তথ্য যাচাইয়ের জন্য প্রয়োজন হতে পারে। যাচাই ছাড়া স্বয়ংক্রিয় রিফান্ড বা রিপ্লেসমেন্টের নিশ্চয়তা নেই; রিপ্লেসমেন্ট পণ্য ও স্টকের প্রাপ্যতার উপর নির্ভর করতে পারে।'
  const cod = settings.footer.payments.cash_on_delivery ? 'বর্তমান SahiGadget চেকআউটে Cash on Delivery পাওয়া যেতে পারে। অর্ডার নিশ্চিত করার আগে বিদ্যমান চেকআউটের যাচাই ও শর্ত প্রযোজ্য হবে।' : 'বর্তমান প্রকাশ্য তথ্য অনুযায়ী Cash on Delivery নিশ্চিত করা যাচ্ছে না।'
  const support = `সহায়তার জন্য ফোন ${siteConfig.contact.phone} অথবা ইমেইল ${siteConfig.contact.supportEmail} ব্যবহার করুন।`
  const store = `${siteConfig.name} বাংলাদেশে মোবাইল ফোন ও গ্যাজেট সরবরাহ করে। সাধারণ সহায়তার জন্য ${siteConfig.contact.supportEmail} অথবা ${siteConfig.contact.phone} ব্যবহার করুন।`
  const map: Record<typeof topic, string> = { delivery, delivery_charge: delivery, warranty, returns, cod, support, store_information: store }
  const sources: RetrievedSource[] = topic === 'support' || topic === 'store_information'
    ? ['site_config']
    : ['public_policy']
  return { topic, text: map[topic], settings, sources }
}

export async function hydrateProductReferences(productIds: string[]) {
  const uniqueIds = Array.from(new Set(productIds)).slice(0, MAX_RESULTS)
  const products = await Promise.all(uniqueIds.map((id) => getProductById(id).catch(() => null)))
  return products.filter((product): product is StorefrontProduct => Boolean(product)).map(getProductCard)
}

export function classifyIntent(message: string): AssistantIntent {
  if (isPrivateRequest(message)) return 'unsupported'
  if (/delivery|ঢাকা|ডেলিভারি|কুরিয়ার|charge|চার্জ/i.test(message)) return 'policy'
  if (/warranty|guarantee|ওয়ারেন্টি|গ্যারান্টি|returns?|রিটার্ন|রিপ্লেস|COD|cash on delivery|ক্যাশ অন ডেলিভারি/i.test(message)) return 'policy'
  if (/price|দাম|মূল্য|৳|tk|টাকা/i.test(message)) return 'price'
  if (/stock|available|availability|স্টক|অ্যাভেইল|প্রাপ্য/i.test(message)) return 'availability'
  if (/variant|color|colour|ram|storage|রঙ|কালার|ভ্যারিয়েন্ট|স্টোরেজ|র‍্যাম/i.test(message)) return 'variant'
  if (/what is|details|spec|বিস্তারিত|স্পেসিফিকেশন|কী কী/i.test(message)) return 'product_detail'
  if (extractBudget(message) || /show|find|দেখান|খুঁজে|চাই|phone|mobile|ফোন|মোবাইল/i.test(message)) return 'product_search'
  if (/store|shop|contact|support|ঠিকানা|যোগাযোগ|সাহিগ্যাজেট|sahigadget/i.test(message)) return 'store_information'
  return 'unclear'
}

export async function retrieveAssistantContext(message: string, intent: AssistantIntent, pageProductId?: string): Promise<RetrievalResult> {
  const retrievedAt = new Date().toISOString()
  if (intent === 'unsupported') return { context: [], sources: [], retrievedAt }
  if (intent === 'policy' || intent === 'store_information') {
    const topic = /warranty|guarantee|ওয়ারেন্টি|গ্যারান্টি/i.test(message) ? 'warranty' : /return|রিটার্ন|রিপ্লেস/i.test(message) ? 'returns' : /cod|cash|ক্যাশ/i.test(message) ? 'cod' : /delivery|ঢাকা|ডেলিভারি|চার্জ/i.test(message) ? 'delivery' : /support|contact|যোগাযোগ|ইমেইল|ফোন/i.test(message) ? 'support' : 'store_information'
    const policy = await getStorePolicy(topic)
    return { context: [], sources: policy.sources, retrievedAt, policyText: policy.text }
  }
  const pageProduct = pageProductId ? await getProductById(pageProductId).catch(() => null) : null
  const budget = extractBudget(message)
  const products = pageProduct && intent !== 'product_search' ? [pageProduct] : await searchProducts({ query: message, maxPrice: budget, onlyAvailable: intent === 'availability', limit: MAX_RESULTS })
  const context = products.map(toContext)
  return { context, sources: context.length ? ['live_product', 'live_variant'] : [], retrievedAt }
}

export function toPublicCard(product: StorefrontProduct): PublicProductCard {
  return getProductCard(product)
}

export function isPrivateAssistantRequest(message: string) {
  return isPrivateRequest(message)
}
