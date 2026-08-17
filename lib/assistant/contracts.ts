import { z } from 'zod'

const uuidSchema = z.string().uuid()

export const assistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(800),
  conversation: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(800) }).strict()).max(6).optional(),
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  pageContext: z.object({
    pathname: z.string().regex(/^\/[A-Za-z0-9/_?=&%.-]*$/).max(240).optional(),
    productId: uuidSchema.optional(),
  }).strict().optional(),
  locale: z.enum(['bn', 'en', 'auto']).default('auto'),
}).strict()

export const assistantModelOutputSchema = z.object({
  answer: z.string().trim().min(1).max(1200),
  locale: z.enum(['bn', 'en']),
  intent: z.enum(['product_search', 'product_detail', 'price', 'availability', 'variant', 'policy', 'store_information', 'unsupported', 'unclear']),
  productIds: z.array(uuidSchema).max(6),
  evidenceStatus: z.enum(['verified', 'partial', 'no_evidence']),
  fallbackReason: z.enum(['none', 'no_matching_products', 'private_request', 'unsupported_topic', 'missing_source', 'ambiguous_request']),
  followUps: z.array(z.string().min(1).max(80)).max(3),
}).strict()

export const assistantIntentSchema = z.enum(['product_search', 'product_detail', 'price', 'availability', 'variant', 'policy', 'store_information', 'unsupported', 'unclear'])

export const publicProductCardSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  imageUrl: z.string().url().nullable(),
  imageAlt: z.string().max(240),
  price: z.number().finite().nonnegative().nullable(),
  compareAtPrice: z.number().finite().nonnegative().nullable(),
  availability: z.enum(['in_stock', 'low_stock', 'out_of_stock']),
  href: z.string().regex(/^\/products\//),
})

export const assistantResponseSchema = z.object({
  requestId: uuidSchema,
  answer: z.string().min(1).max(1200),
  locale: z.enum(['bn', 'en']),
  intent: assistantIntentSchema,
  products: z.array(publicProductCardSchema).max(6),
  evidence: z.object({
    status: z.enum(['verified', 'no_evidence', 'partial']),
    sourceTypes: z.array(z.enum(['live_product', 'live_variant', 'public_policy', 'site_config'])).max(4),
    retrievedAt: z.string().datetime(),
  }).strict(),
  followUps: z.array(z.string().min(1).max(80)).max(3),
}).strict()

export type AssistantRequest = z.infer<typeof assistantRequestSchema>
export type AssistantModelOutput = z.infer<typeof assistantModelOutputSchema>
export type PublicProductCard = z.infer<typeof publicProductCardSchema>
export type AssistantResponse = z.infer<typeof assistantResponseSchema>
export type AssistantIntent = z.infer<typeof assistantIntentSchema>

export const modelJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: { type: 'string', minLength: 1, maxLength: 1200 },
    locale: { type: 'string', enum: ['bn', 'en'] },
    intent: { type: 'string', enum: ['product_search', 'product_detail', 'price', 'availability', 'variant', 'policy', 'store_information', 'unsupported', 'unclear'] },
    productIds: { type: 'array', maxItems: 6, items: { type: 'string', format: 'uuid' } },
    evidenceStatus: { type: 'string', enum: ['verified', 'partial', 'no_evidence'] },
    fallbackReason: { type: 'string', enum: ['none', 'no_matching_products', 'private_request', 'unsupported_topic', 'missing_source', 'ambiguous_request'] },
    followUps: { type: 'array', maxItems: 3, items: { type: 'string', minLength: 1, maxLength: 80 } },
  },
  required: ['answer', 'locale', 'intent', 'productIds', 'evidenceStatus', 'fallbackReason', 'followUps'],
} as const
