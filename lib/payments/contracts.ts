export const PAYMENT_PROVIDERS = ['COD', 'BDGATE', 'BKASH', 'NAGAD', 'ROCKET'] as const
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]

export const PAYMENT_CAPABILITIES = ['CREATE_PAYMENT', 'VERIFY_PAYMENT', 'REFUND', 'CANCEL', 'WEBHOOK', 'QUERY_STATUS'] as const
export type PaymentCapability = (typeof PAYMENT_CAPABILITIES)[number]

export type PaymentRequirement = 'COD' | 'FULL_ADVANCE' | 'PARTIAL_ADVANCE' | 'MANUAL_REVIEW'
export type PaymentStatus = 'NOT_REQUIRED' | 'PENDING' | 'INITIATED' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
export type PaymentFailureCategory = 'PAYMENT_DECLINED' | 'PAYMENT_TIMEOUT' | 'PAYMENT_CANCELLED' | 'PAYMENT_VERIFICATION_FAILED' | 'PAYMENT_PROVIDER_UNAVAILABLE' | 'PAYMENT_AMOUNT_MISMATCH' | 'PAYMENT_EXPIRED' | 'UNKNOWN_PAYMENT_ERROR'

export type PaymentIntent = {
  id: string
  orderId: string
  provider: PaymentProvider
  amount: number
  currency: 'BDT'
  status: PaymentStatus
  paymentRequirement: PaymentRequirement
  paymentUrl: string | null
  transactionId: string | null
  providerReference: string | null
  createdAt: string
  expiresAt: string | null
}

export type PaymentStatusResult = {
  provider: PaymentProvider
  status: PaymentStatus
  transactionId: string | null
  providerReference: string | null
  amount: number | null
  currency: string | null
  failureCategory: PaymentFailureCategory | null
}

export type PaymentAdapter = {
  provider: PaymentProvider
  capabilities: ReadonlySet<PaymentCapability>
  createPayment?: (input: { orderId: string; amount: number; idempotencyKey: string; customerName?: string; customerEmail?: string | null; customerPhone?: string | null; successUrl?: string; failUrl?: string; cancelUrl?: string; webhookUrl?: string }) => Promise<{ providerPaymentId: string; redirectUrl: string; status: 'PENDING'; expiresAt?: string | null }>
  verifyPayment?: (input: { providerPaymentId: string; expectedOrderId?: string; expectedAmount?: number; expectedCurrency?: 'BDT' }) => Promise<{ status: 'VERIFIED' | 'FAILED' | 'PENDING'; amount?: number; currency?: string; transactionId?: string | null; providerReference?: string | null; failureCategory?: PaymentFailureCategory | null }>
  getPaymentStatus?: (input: { providerPaymentId: string }) => Promise<PaymentStatusResult>
}
