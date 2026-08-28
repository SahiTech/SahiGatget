import type { Metadata } from 'next'

import { DeliveryOperationsShell } from '@/components/admin/delivery-operations-shell'
import { getDeliveryOperationsData } from '@/lib/admin/delivery-data'

export const metadata: Metadata = { title: 'Delivery operations', robots: { index: false, follow: false } }

export default async function DeliveryPage({ searchParams }: { searchParams: Promise<{ query?: string; orderStatus?: string; shipmentStatus?: string; provider?: string; risk?: string }> }) {
  const filters = await searchParams
  const data = await getDeliveryOperationsData(filters)
  return <DeliveryOperationsShell data={data} />
}
