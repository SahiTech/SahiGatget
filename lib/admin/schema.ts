import { z } from 'zod'

const uuid = z.string().uuid()
const optionalText = z.string().trim().max(5000).optional().or(z.literal(''))
const optionalShortText = z.string().trim().max(255).optional().or(z.literal(''))

export const adminLoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(256),
})

export const productSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2).max(255),
  slug: z.string().trim().min(2).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  brandId: uuid.nullable().optional(),
  categoryId: uuid.nullable().optional(),
  productType: z.enum(['phone', 'feature_phone', 'accessory']).default('phone'),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  shortDescription: optionalText,
  description: optionalText,
  warrantyPolicy: z.string().trim().min(3).max(5000),
  metaTitle: optionalShortText,
  metaDescription: optionalText,
})

export const brandSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2).max(255),
  slug: z.string().trim().min(2).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: optionalText,
  logoUrl: z.string().url().max(2048).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  metaTitle: optionalShortText,
  metaDescription: optionalText,
})

export const categorySchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2).max(255),
  slug: z.string().trim().min(2).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: optionalText,
  imageUrl: z.string().url().max(2048).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
  isActive: z.boolean().default(true),
  metaTitle: optionalShortText,
  metaDescription: optionalText,
})

export const variantSchema = z.object({
  id: uuid.optional(),
  productId: uuid,
  sku: z.string().trim().min(2).max(100).regex(/^[A-Za-z0-9._-]+$/),
  variantTitle: z.string().trim().min(2).max(255),
  ram: optionalShortText,
  storage: optionalShortText,
  color: optionalShortText,
  price: z.coerce.number().finite().min(0).max(99999999),
  compareAtPrice: z.coerce.number().finite().min(0).max(99999999).nullable().optional(),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000).default(5),
  isActive: z.boolean().default(true),
})

export const stockAdjustmentSchema = z.object({
  variantId: uuid,
  changeAmount: z.coerce.number().int().refine((value) => value !== 0, 'Enter a non-zero quantity.'),
  movementType: z.enum(['RESTOCK', 'SALE', 'RETURN', 'DAMAGE', 'ADJUSTMENT', 'RESERVATION', 'RELEASE']),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})

export const imeiSchema = z.object({
  id: uuid.optional(),
  variantId: uuid,
  imei1: z.string().trim().min(8).max(100),
  imei2: z.string().trim().max(100).optional().or(z.literal('')),
  serialNumber: z.string().trim().max(100).optional().or(z.literal('')),
  status: z.enum(['in_stock', 'allocated', 'sold', 'returned', 'defective']).default('in_stock'),
  orderId: uuid.nullable().optional(),
})

export const orderStatusSchema = z.object({
  orderId: uuid,
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED']),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})

const socialUrl = (platform: string) => z.string().trim().url().max(2048).refine((value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '')
    const allowed: Record<string, string[]> = {
      facebook: ['facebook.com', 'm.facebook.com'],
      tiktok: ['tiktok.com'],
      instagram: ['instagram.com'],
      x: ['x.com', 'twitter.com'],
      youtube: ['youtube.com', 'youtu.be'],
    }
    return (allowed[platform] ?? []).some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  } catch {
    return false
  }
}, `Enter a valid ${platform} URL.`)

const optionalSocialUrl = (platform: string) => z.union([socialUrl(platform), z.literal('')])

export const footerConfigSchema = z.object({
  social: z.object({
    facebook: optionalSocialUrl('facebook'),
    tiktok: optionalSocialUrl('tiktok'),
    instagram: optionalSocialUrl('instagram'),
    x: optionalSocialUrl('x'),
    youtube: optionalSocialUrl('youtube'),
  }),
  payments: z.object({
    cash_on_delivery: z.boolean(),
    visa: z.boolean(),
    mastercard: z.boolean(),
  }),
})

export const settingsSchema = z.object({
  deliveryCharges: z.object({
    dhaka: z.coerce.number().finite().min(0).max(100000),
    outside_dhaka: z.coerce.number().finite().min(0).max(100000),
  }),
  businessPolicy: z.object({
    guarantee_days: z.coerce.number().int().min(0).max(365),
    service_warranty_years: z.coerce.number().int().min(0).max(20),
    policy_text: z.string().trim().min(10).max(5000),
  }),
  storeProfile: z.object({
    business_name: z.string().trim().min(2).max(255),
    established: z.coerce.number().int().min(1900).max(2100),
    tagline: z.string().trim().min(2).max(255),
    brand_promise: z.string().trim().min(2).max(500),
    location: z.string().trim().min(2).max(500),
    phone: z.string().trim().min(7).max(50),
    public_email: z.string().trim().email().max(255),
    admin_email: z.string().trim().email().max(255),
    currency: z.literal('BDT'),
    languages: z.array(z.string().trim().min(2).max(50)).min(1).max(5),
  }),
  returnRefundPolicy: z.object({
    policy_text: z.string().trim().min(20).max(5000),
  }),
})

export const adminUserSchema = z.object({
  userId: uuid,
  fullName: z.string().trim().min(2).max(255),
  email: z.string().trim().email().max(255),
  role: z.enum(['OWNER', 'ADMIN', 'STAFF']),
  isActive: z.boolean(),
})

export type ProductInput = z.infer<typeof productSchema>
export type VariantInput = z.infer<typeof variantSchema>

export const bannerSchema = z.object({
  id: uuid.optional(),
  desktopImageUrl: z.string().url().max(2048),
  mobileImageUrl: z.string().url().max(2048),
  heading: z.string().trim().min(2).max(255),
  description: z.string().trim().min(2).max(1000),
  primaryCtaText: z.string().trim().min(1).max(50),
  primaryCtaUrl: z.string().trim().min(1).max(500),
  secondaryCtaText: optionalShortText,
  secondaryCtaUrl: z.string().trim().max(500).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
})

export type BannerInput = z.infer<typeof bannerSchema>
