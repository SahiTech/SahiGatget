import type { Metadata } from 'next'
import { AdminPageHeader } from '@/components/admin/admin-shell'
import { CheckoutRecoveryManager } from '@/components/admin/checkout-recovery-manager'
import { listCheckoutRecovery } from '@/lib/commerce/checkout-recovery-actions'

export const metadata: Metadata = { title: 'Checkout recovery', robots: { index: false, follow: false } }

export default async function CheckoutRecoveryPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; q?: string }> }) {
  const params = await searchParams
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const status = params.status
  const result = await listCheckoutRecovery({ page, status, q: params.q })
  return <div><AdminPageHeader eyebrow="Customer recovery" title="Incomplete checkouts" description="Review saved checkout progress and manually offer help only where explicit recovery consent is active. Opening WhatsApp is recorded as an attempt, not proof of delivery." /><CheckoutRecoveryManager {...result} status={status} q={params.q} now={new Date().toISOString()} /></div>
}
