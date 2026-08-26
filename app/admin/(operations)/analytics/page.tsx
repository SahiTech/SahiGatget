import type { Metadata } from 'next'
import { AdminPageHeader } from '@/components/admin/admin-shell'
import { AnalyticsControlCenter } from '@/components/admin/analytics-control-center'
import { getAnalyticsAdminConfig } from '@/lib/admin/analytics-actions'
import { getAnalyticsDiagnostics } from '@/lib/analytics/diagnostics'

export const metadata: Metadata = { title: 'Commerce Analytics Control Center', robots: { index: false, follow: false } }
export default async function AnalyticsPage() { const [config, diagnostics] = await Promise.all([getAnalyticsAdminConfig(), getAnalyticsDiagnostics()]); return <div><AdminPageHeader eyebrow="Commerce observability" title="Analytics Control Center" description="Configure consent-aware, privacy-safe commerce analytics destinations and run synthetic diagnostics without touching customer orders." /><AnalyticsControlCenter initial={config} diagnostics={diagnostics} /></div> }
