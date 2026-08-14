import type { Metadata } from 'next'

import { AdminPageHeader } from '@/components/admin/admin-shell'
import { SettingsManager } from '@/components/admin/settings-manager'
import { getSettingsData } from '@/lib/admin/data'

export const metadata: Metadata = { title: 'Store settings', robots: { index: false, follow: false } }

export default async function SettingsPage() {
  const data = await getSettingsData()
  return <div><AdminPageHeader eyebrow="Store controls" title="Delivery, warranty & store settings" description="Operational settings are editable by OWNER and ADMIN. Store profile, return policy, audit activity, and access records are OWNER-only." /><SettingsManager {...data} /></div>
}
