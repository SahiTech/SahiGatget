'use client'

import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'

import { savePathaoConfigurationAction } from '@/lib/admin/delivery-actions'

type PathaoConfigurationStatus = {
  configured: boolean
  source: 'ADMIN' | 'ENVIRONMENT' | 'NONE'
  environment: 'PRODUCTION'
  baseUrl: string
  clientIdConfigured: boolean
  usernameConfigured: boolean
  clientSecretConfigured: boolean
  passwordConfigured: boolean
}

export function PathaoConfigurationCard({ status }: { status: PathaoConfigurationStatus }) {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await savePathaoConfigurationAction({ clientId, clientSecret, username, password })
      setMessage(result.message)
      if (result.ok && typeof window !== 'undefined') window.setTimeout(() => window.location.reload(), 500)
    })
  }

  const safeStatus = status.configured ? 'Configured' : 'Not configured'
  const sourceLabel = status.source === 'ADMIN' ? 'Admin configuration' : status.source === 'ENVIRONMENT' ? 'Server environment fallback' : 'None'

  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Delivery Provider</p>
        <h2 className="mt-1 font-semibold">Pathao · Production Configuration</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Credentials are encrypted server-side. Existing secret values remain masked; leave secret fields blank to keep them unchanged.</p>
      </div>
      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${status.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{safeStatus}</span>
    </div>
    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
      <p className="rounded-lg bg-slate-50 p-2"><span className="font-semibold text-slate-600">Environment</span><strong className="ml-2 text-slate-900">{status.environment}</strong></p>
      <p className="rounded-lg bg-slate-50 p-2"><span className="font-semibold text-slate-600">Source</span><strong className="ml-2 text-slate-900">{sourceLabel}</strong></p>
      <p className="rounded-lg bg-slate-50 p-2 sm:col-span-2"><span className="font-semibold text-slate-600">Production API</span><strong className="ml-2 break-all text-slate-900">{status.baseUrl}</strong></p>
    </div>
    <form onSubmit={saveConfiguration} className="mt-4 space-y-3">
      <label className="block text-xs font-semibold text-slate-600">Client ID<input value={clientId} onChange={(event) => setClientId(event.target.value)} required={!status.clientIdConfigured} autoComplete="off" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" placeholder={status.clientIdConfigured ? 'Configured — enter a new value to replace' : 'Pathao Client ID'} /></label>
      <label className="block text-xs font-semibold text-slate-600">Client Secret<input value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} required={!status.clientSecretConfigured} type="password" autoComplete="new-password" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" placeholder={status.clientSecretConfigured ? 'Configured — leave blank to keep' : 'Pathao Client Secret'} /></label>
      <label className="block text-xs font-semibold text-slate-600">Username / Email<input value={username} onChange={(event) => setUsername(event.target.value)} required={!status.usernameConfigured} autoComplete="off" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" placeholder={status.usernameConfigured ? 'Configured — enter a new value to replace' : 'Pathao username or email'} /></label>
      <label className="block text-xs font-semibold text-slate-600">Password<input value={password} onChange={(event) => setPassword(event.target.value)} required={!status.passwordConfigured} type="password" autoComplete="new-password" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" placeholder={status.passwordConfigured ? 'Configured — leave blank to keep' : 'Pathao password'} /></label>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] leading-4 text-slate-500">Client Secret and Password are never returned, logged, or displayed after saving.</p>
        <button type="submit" disabled={isPending} className="shrink-0 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{isPending ? 'Saving…' : 'Save Configuration'}</button>
      </div>
      {message ? <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{message}</p> : null}
    </form>
  </section>
}
