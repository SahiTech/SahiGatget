import type { Metadata } from 'next'

import { AdminPageHeader } from '@/components/admin/admin-shell'
import { InventoryManager } from '@/components/admin/inventory-manager'
import { getInventoryData } from '@/lib/admin/data'

export const metadata: Metadata = { title: 'Inventory operations', robots: { index: false, follow: false } }

export default async function InventoryPage() {
  const data = await getInventoryData()
  return <div><AdminPageHeader eyebrow="Inventory operations" title="Stock, movement ledger & devices" description="Stock quantities change only through controlled business movements. IMEI and serial records are restricted to OWNER and ADMIN roles." /><InventoryManager {...data} /></div>
}
