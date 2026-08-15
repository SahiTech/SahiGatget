import { z } from 'zod'

const optionalText = z.string().trim().max(500).optional().or(z.literal(''))

export const orderSelectionSchema = z.object({
  productId: z.string().uuid('Please select a valid product.'),
  variantId: z.string().uuid('Please select a valid variant.'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1.').max(10, 'Maximum quantity is 10 per order.'),
})

export const customerDetailsSchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your full name.').max(120, 'Name is too long.'),
  phone: z.string().trim().regex(/^(?:\+?88)?01[3-9]\d{8}$/, 'Enter a valid Bangladeshi mobile number.'),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email address.')]).optional(),
})

export const deliveryDetailsSchema = z.object({
  division: z.string().trim().min(2, 'Select your division.').max(80),
  district: z.string().trim().min(2, 'Enter your district.').max(80),
  area: z.string().trim().min(2, 'Enter your area or upazila.').max(100),
  address: z.string().trim().min(8, 'Enter your full delivery address.').max(500),
  postalCode: optionalText,
  notes: optionalText,
})

export const guestOrderInputSchema = orderSelectionSchema
  .merge(customerDetailsSchema)
  .merge(deliveryDetailsSchema)
  .extend({ checkoutRequestId: z.string().uuid('Unable to verify this checkout request. Please try again.') })

export const orderQuoteInputSchema = orderSelectionSchema.merge(z.object({
  division: z.string().trim().min(2, 'Select your division.').max(80),
}))

export const trackingLookupSchema = z.object({
  orderNumber: z.string().trim().regex(/^SG-\d{8}-[A-F0-9]{8}$/i, 'Enter the complete SahiGadget order number.'),
  phone: z.string().trim().regex(/^(?:\+?88)?01[3-9]\d{8}$/, 'Enter the mobile number used for the order.'),
})

export type GuestOrderInput = z.infer<typeof guestOrderInputSchema>
export type OrderQuoteInput = z.infer<typeof orderQuoteInputSchema>
export type TrackingLookupInput = z.infer<typeof trackingLookupSchema>

export type Quote = {
  productName: string
  variantTitle: string
  sku: string
  quantity: number
  unitPrice: number
  compareAtPrice: number | null
  discountTotal: number
  subtotal: number
  deliveryCharge: number
  grandTotal: number
  deliveryZone: 'dhaka' | 'outside_dhaka'
  warrantyPolicy: string
  available: boolean
}

export type OrderSuccessSummary = {
  orderId: string
  orderNumber: string
  customerName: string
  customerEmail: string | null
  phone: string
  status: string
  createdAt: string
  delivery: {
    division: string
    district: string
    area: string
    address: string
    postalCode: string | null
    notes: string | null
    charge: number
  }
  paymentMethod: 'COD'
  subtotal: number
  discountTotal: number
  grandTotal: number
  items: Array<{
    productName: string
    variantTitle: string
    sku: string
    quantity: number
    unitPrice: number
    compareAtPrice: number | null
    discountAmount: number
    lineTotal: number
    warrantyPolicy: string | null
  }>
}

export type TrackingSummary = {
  orderNumber: string
  status: string
  createdAt: string
  paymentMethod: 'COD'
  paymentStatus: string
  subtotal: number
  discountTotal: number
  deliveryCharge: number
  grandTotal: number
  warrantyPolicy: string | null
  canDownloadInvoice: boolean
  timeline: Array<{ status: string; createdAt: string }>
  items: Array<{ productName: string; variantTitle: string; quantity: number }>
}
