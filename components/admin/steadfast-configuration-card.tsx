'use client'

import { useState, useTransition } from 'react'
import { getSteadfastConfigurationStatusAction, saveSteadfastConfigurationAction, testSteadfastConnectionAction } from '@/lib/admin/steadfast-actions'

type Status = { configured: boolean; webhookConfigured: boolean; baseUrl: string; lastTest?: string | null }

export function SteadfastConfigurationCard({ initialStatus }: { initialStatus: Status }) {
  const [status, setStatus] = useState(initialStatus)
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [webhookToken, setWebhookToken] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const result = await saveSteadfastConfigurationAction({ apiKey, secretKey, webhookToken })
      setMessage(result.message)
      if (result.ok) {
        const next = await getSteadfastConfigurationStatusAction()
        setStatus(next)
        setApiKey(''); setSecretKey(''); setWebhookToken('')
      }
    })
  }

  function test() {
    startTransition(async () => {
      try {
        const result = await testSteadfastConnectionAction()
        setMessage(result.ok ? `Connection PASS · Balance ${result.balance ?? 'unavailable'}.` : 'Connection failed.')
        const next = await getSteadfastConfigurationStatusAction()
        setStatus(next)
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Connection test failed.') }
    })
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">Delivery Provider</p><h2 className="mt-1 font-semibold">Steadfast · Production Configuration</h2><p className="mt-1 text-xs leading-5 text-slate-500">API credentials are encrypted server-side. Existing secrets stay masked; leave a secret blank to keep the current value.</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${status.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{status.configured ? 'Configured' : 'Not configured'}</span></div>
    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><p className="rounded-lg bg-slate-50 p-2"><span className="font-semibold text-slate-600">Environment</span><strong className="ml-2 text-slate-900">PRODUCTION</strong></p><p className="rounded-lg bg-slate-50 p-2"><span className="font-semibold text-slate-600">Webhook token</span><strong className="ml-2 text-slate-900">{status.webhookConfigured ? 'Configured' : 'Not configured'}</strong></p><p className="rounded-lg bg-slate-50 p-2 sm:col-span-2"><span className="font-semibold text-slate-600">API</span><strong className="ml-2 break-all text-slate-900">{status.baseUrl}</strong></p></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="block text-xs font-semibold text-slate-600">API Key<input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" autoComplete="new-password" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder={status.configured ? 'Configured — leave blank to keep' : 'Steadfast API Key'} /></label><label className="block text-xs font-semibold text-slate-600">Secret Key<input value={secretKey} onChange={e => setSecretKey(e.target.value)} type="password" autoComplete="new-password" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder={status.configured ? 'Configured — leave blank to keep' : 'Steadfast Secret Key'} /></label><label className="block text-xs font-semibold text-slate-600">Webhook Bearer Token<input value={webhookToken} onChange={e => setWebhookToken(e.target.value)} type="password" autoComplete="new-password" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder={status.webhookConfigured ? 'Configured — leave blank to keep' : 'Optional until webhook setup'} /></label></div>
    <div className="mt-3 flex flex-wrap justify-end gap-2"><button onClick={save} disabled={isPending} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Save Configuration</button><button onClick={test} disabled={isPending || !status.configured} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 disabled:opacity-50">Test Connection</button></div>
    {message ? <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{message}</p> : null}
  </section>
}
