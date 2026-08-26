export const PAYMENT_PROVIDERS = ['COD', 'BKASH', 'NAGAD', 'ROCKET'] as const
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]

export const PAYMENT_CAPABILITIES = ['CREATE_PAYMENT', 'VERIFY_PAYMENT', 'REFUND', 'CANCEL', 'WEBHOOK', 'QUERY_STATUS'] as const
export type PaymentCapability = (typeof PAYMENT_CAPABILITIES)[number]

export type PaymentAdapter = {
  provider: PaymentProvider
  capabilities: ReadonlySet<PaymentCapability>
  createPayment?: (input: { orderId: string; amount: number; idempotencyKey: string }) => Promise<{ providerPaymentId: string; status: 'PENDING' }>
  verifyPayment?: (input: { providerPaymentId: string }) => Promise<{ status: 'VERIFIED' | 'FAILED' | 'PENDING' }>
}
