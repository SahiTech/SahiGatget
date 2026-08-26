import type { Metadata } from 'next'
import Link from 'next/link'

import { AdminPageHeader } from '@/components/admin/admin-shell'
import { SettingsManager } from '@/components/admin/settings-manager'
import { getSettingsData } from '@/lib/admin/data'

export const metadata: Metadata = { title: 'Store settings', robots: { index: false, follow: false } }

export default async function SettingsPage() {
  const data = await getSettingsData()
  return <div><AdminPageHeader eyebrow="Store controls" title="Delivery, warranty & store settings" description="Operational settings are editable by OWNER and ADMIN. Store profile, return policy, audit activity, and access records are OWNER-only." /><div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm font-black text-slate-950">Analytics configuration</p><p className="mt-1 text-sm leading-6 text-slate-600">Provider IDs, consent mode, event controls, and diagnostics are managed in the existing Admin Analytics Control Center.</p><Link href="/admin/analytics" className="mt-3 inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white">Open Analytics Control Center</Link></div><SettingsManager {...data} /></div>
}
