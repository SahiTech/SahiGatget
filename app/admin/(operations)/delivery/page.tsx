import type { Metadata } from 'next'

import { getDeliveryOperationsData } from '@/lib/admin/delivery-data'
import { getSteadfastConfigurationStatusAction } from '@/lib/admin/steadfast-actions'
import { DeliveryOperationsCenter } from '@/components/admin/delivery-operations-center'
import { SteadfastConfigurationCard } from '@/components/admin/steadfast-configuration-card'

export const metadata: Metadata = { title: 'Delivery operations', robots: { index: false, follow: false } }

export default async function DeliveryPage({ searchParams }: { searchParams: Promise<{ query?: string; orderStatus?: string; shipmentStatus?: string; provider?: string; risk?: string }> }) {
  const filters = await searchParams
  const [data, steadfastStatus] = await Promise.all([getDeliveryOperationsData(filters), getSteadfastConfigurationStatusAction()])
  return <><div className="mx-auto mb-6 max-w-7xl px-4 sm:px-6 lg:px-8"><SteadfastConfigurationCard initialStatus={steadfastStatus} /></div><DeliveryOperationsCenter data={data} /></>
}
