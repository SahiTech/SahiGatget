import type { Metadata } from 'next'

import { AdminPageHeader } from '@/components/admin/admin-shell'
import { AssistantControlCenter } from '@/components/admin/assistant-control-center'
import { getAssistantControlCenterData } from '@/lib/admin/assistant-data'

export const metadata: Metadata = { title: 'AI Assistant Control Center', robots: { index: false, follow: false } }

export default async function AiAssistantPage({ searchParams }: { searchParams: Promise<{ range?: string; page?: string }> }) {
  const params = await searchParams
  const range = params.range === 'today' || params.range === '30d' ? params.range : '7d'
  const page = Number.parseInt(params.page ?? '1', 10)
  const data = await getAssistantControlCenterData({ range, page: Number.isFinite(page) ? page : 1 })
  return <div><AdminPageHeader eyebrow="Customer intelligence" title="AI Assistant Control Center" description="Control the public assistant, review approved policy wording, monitor runtime readiness, and inspect aggregate customer questions without exposing private data." /><AssistantControlCenter {...data} /></div>
}
