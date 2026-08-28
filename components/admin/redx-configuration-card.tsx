'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Copy, ExternalLink, RefreshCw } from 'lucide-react'
import { getRedxConfigurationStatusAction, saveRedxConfigurationAction, testRedxConnectionAction } from '@/lib/admin/redx-actions'

type Status = {
  configured: boolean
  webhookConfigured: boolean
  baseUrl: string
  callbackUrl: string
  connectionState: string
  isEnabled: boolean
  pickupStoreId: number | null
  lastTestAt?: string | null
  lastTest?: string | null
}

export function RedxConfigurationCard({ initialStatus }: { initialStatus: Status }) {
  const [status, setStatus] = useState(initialStatus)
  const [apiToken, setApiToken] = useState('')
  const [webhookToken, setWebhookToken] = useState('')
  const [pickupStoreId, setPickupStoreId] = useState(initialStatus.pickupStoreId ? String(initialStatus.pickupStoreId) : '')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const result = await saveRedxConfigurationAction({ apiToken, webhookToken, pickupStoreId: pickupStoreId ? Number(pickupStoreId) : null })
      setMessage(result.message)
      if (result.ok) {
        const next = await getRedxConfigurationStatusAction()
        setStatus(next)
        setApiToken('')
        setWebhookToken('')
      }
    })
  }

  function test() {
    startTransition(async () => {
      const result = await testRedxConnectionAction()
      setMessage(result.message)
      if (result.selectedPickupStoreId) setPickupStoreId(String(result.selectedPickupStoreId))
      const next = await getRedxConfigurationStatusAction()
      setStatus(next)
    })
  }

  async function copyCallback() {
    await navigator.clipboard.writeText(status.callbackUrl)
    setMessage('REDX callback URL copied. Append ?token=YOUR_WEBHOOK_TOKEN in the RedX webhook configuration.')
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">Delivery Provider</p><h2 className="mt-1 font-semibold">REDX · Production Configuration</h2><p className="mt-1 text-xs leading-5 text-slate-500">Production OpenAPI credentials are encrypted server-side. Existing secrets stay masked; leave a secret blank to keep the current value.</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${status.configured && status.isEnabled ? 'bg-emerald-100 text-emerald-800' : status.configured ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{status.configured && status.isEnabled ? 'Verified' : status.configured ? 'Configured' : 'Not configured'}</span></div>
    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><p className="rounded-lg bg-slate-50 p-2"><span className="font-semibold text-slate-600">Environment</span><strong className="ml-2 text-slate-900">PRODUCTION</strong></p><p className="rounded-lg bg-slate-50 p-2"><span className="font-semibold text-slate-600">Webhook token</span><strong className="ml-2 text-slate-900">{status.webhookConfigured ? 'Configured' : 'Not configured'}</strong></p><p className="rounded-lg bg-slate-50 p-2 sm:col-span-2"><span className="font-semibold text-slate-600">API</span><strong className="ml-2 break-all text-slate-900">{status.baseUrl}</strong></p></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-xs font-semibold text-slate-600">Production API Token<input value={apiToken} onChange={e => setApiToken(e.target.value)} type="password" autoComplete="new-password" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder={status.configured ? 'Configured — leave blank to keep' : 'Paste REDX production token'} /></label><label className="block text-xs font-semibold text-slate-600">Webhook Token<input value={webhookToken} onChange={e => setWebhookToken(e.target.value)} type="password" autoComplete="new-password" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder={status.webhookConfigured ? 'Configured — leave blank to keep' : 'Create a strong secret for ?token='} /></label></div>
    <label className="mt-3 block text-xs font-semibold text-slate-600">Pickup Store ID (optional before first test)<input value={pickupStoreId} onChange={e => setPickupStoreId(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="Leave blank to use the first available pickup store" /></label>
    <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/50 p-3"><div className="flex items-start gap-2"><ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" /><div className="min-w-0"><p className="text-xs font-bold text-rose-900">Webhook callback</p><p className="mt-1 break-all font-mono text-[11px] text-rose-800">{status.callbackUrl}</p><p className="mt-1 text-[11px] leading-4 text-rose-800">REDX documents webhook credentials in the callback query string. Configure the URL as <strong>{status.callbackUrl}?token=YOUR_WEBHOOK_TOKEN</strong>.</p></div><button type="button" onClick={copyCallback} className="rounded-lg border border-rose-200 bg-white p-2 text-rose-700" aria-label="Copy callback URL"><Copy className="h-4 w-4" /></button></div></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs"><div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Connection</p><p className="mt-1 font-semibold text-slate-900">{status.connectionState}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pickup store</p><p className="mt-1 font-semibold text-slate-900">{status.pickupStoreId ?? 'Auto-select'}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Last test</p><p className="mt-1 font-semibold text-slate-900">{status.lastTest ?? 'NOT TESTED'}</p></div></div>
    <div className="mt-3 flex flex-wrap justify-end gap-2"><button onClick={save} disabled={isPending} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Save Configuration</button><button onClick={test} disabled={isPending || !status.configured} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 disabled:opacity-50">{isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Test Connection</button></div>
    {status.lastTestAt ? <p className="mt-3 text-[11px] text-slate-500">Last verification: {status.lastTestAt}</p> : null}
    {message ? <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{message}</p> : null}
  </section>
}
