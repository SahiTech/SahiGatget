'use client'

import { useEffect, useState, useTransition } from 'react'
import { CheckCircle2, ChevronDown, Settings2, ShieldCheck, Truck, X } from 'lucide-react'

import { testPathaoConnectionAction } from '@/lib/admin/delivery-actions'
import { getSteadfastConfigurationStatusAction } from '@/lib/admin/steadfast-actions'
import { getRedxConfigurationStatusAction } from '@/lib/admin/redx-actions'
import { PathaoConfigurationCard } from './pathao-configuration-card'
import { SteadfastConfigurationCard } from './steadfast-configuration-card'
import { RedxConfigurationCard } from './redx-configuration-card'

type Provider = {
  provider: string
  display_name: string
  connection_state?: string | null
  is_enabled?: boolean
  credentialsRequired?: boolean
  readiness?: string | null
  catalogCapabilities?: string[]
  metadata?: Record<string, any>
}

type Props = { data: any }

const capabilityLabels: Record<string, string> = {
  CREATE_SHIPMENT: 'Shipment',
  TRACK_SHIPMENT: 'Tracking',
  WEBHOOK: 'Webhooks',
  GET_BALANCE: 'Balance',
}

function getStatus(item: Provider, pathaoVerified: boolean) {
  if (item.provider === 'PATHAO') return pathaoVerified ? 'VERIFIED' : item.credentialsRequired ? 'NOT CONFIGURED' : 'API UNVERIFIED'
  if (item.readiness === 'NOT_IMPLEMENTED') return 'API UNVERIFIED'
  return item.connection_state === 'CONNECTED' && item.is_enabled ? 'VERIFIED' : item.credentialsRequired ? 'NOT CONFIGURED' : 'API UNVERIFIED'
}

function statusClass(status: string) {
  if (status === 'VERIFIED') return 'bg-emerald-100 text-emerald-800'
  if (status === 'NOT CONFIGURED') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

export function DeliveryProviderNetwork({ data }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [pathaoTest, setPathaoTest] = useState<any | null>(null)
  const [steadfastStatus, setSteadfastStatus] = useState<any | null>(null)
  const [redxStatus, setRedxStatus] = useState<any | null>(null)
  const [isPending, startTransition] = useTransition()

  const pathaoProvider = data.providers.find((item: Provider) => item.provider === 'PATHAO')
  const persisted = pathaoProvider?.metadata?.last_connection_test
  const pathaoVerified = ['authentication', 'store', 'city', 'zone', 'area', 'price'].every((key) => persisted?.[key] === 'PASS')
  const selectedProvider = data.providers.find((item: Provider) => item.provider === selected)

  useEffect(() => {
    if (!selected) return
    if (selected === 'STEADFAST') void getSteadfastConfigurationStatusAction().then(setSteadfastStatus).catch(() => setSteadfastStatus(null))
    if (selected === 'REDX') void getRedxConfigurationStatusAction().then(setRedxStatus).catch(() => setRedxStatus(null))
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setSelected(null)
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selected])

  function verifyPathao() {
    startTransition(async () => setPathaoTest(await testPathaoConnectionAction()))
  }

  return <>
    <section className="delivery-provider-network rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="flex w-full items-center justify-between gap-4 p-4 text-left">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Truck className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Delivery network</p>
            <h2 className="mt-0.5 truncate text-base font-semibold text-slate-950">Courier integrations</h2>
            <p className="mt-0.5 text-xs text-slate-500">Production connections are managed from Configure.</p>
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-4 pb-4 pt-3">
        {data.providers.map((item: Provider) => {
          const status = getStatus(item, pathaoVerified)
          return <span key={item.provider} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200"><span className={`h-1.5 w-1.5 rounded-full ${status === 'VERIFIED' ? 'bg-emerald-500' : status === 'NOT CONFIGURED' ? 'bg-amber-500' : 'bg-slate-400'}`} />{item.display_name} · {status}</span>
        })}
      </div>

      {expanded ? <div className="border-t border-slate-100 p-3">
        <div className="grid gap-2">
          {data.providers.map((item: Provider) => {
            const status = getStatus(item, pathaoVerified)
            return <article key={item.provider} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black text-slate-700 ring-1 ring-slate-200">{item.display_name.slice(0, 1)}</span>
                  <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-slate-950">{item.display_name}</h3><p className="text-[11px] text-slate-500">Production API</p></div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${statusClass(status)}`}>{status}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">{(item.catalogCapabilities ?? []).map((capability) => <span key={capability} className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">{capabilityLabels[capability] ?? capability}</span>)}</div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">{status === 'VERIFIED' ? 'Live API verified' : item.readiness === 'NOT_IMPLEMENTED' ? 'Runtime not enabled' : 'Configuration required'}</p>
                <button type="button" onClick={() => setSelected(item.provider)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-950 px-2.5 text-[11px] font-bold text-white hover:bg-emerald-700"><Settings2 className="h-3.5 w-3.5" /> Configure</button>
              </div>
            </article>
          })}
        </div>
      </div> : null}
    </section>

    {selected ? <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/40 p-0 sm:p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
      <section role="dialog" aria-modal="true" aria-labelledby="delivery-provider-title" className="h-full w-full max-w-xl overflow-y-auto bg-slate-50 shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Provider configuration</p><h2 id="delivery-provider-title" className="mt-1 text-xl font-semibold text-slate-950">{selectedProvider?.display_name ?? selected}</h2><p className="mt-1 text-xs leading-5 text-slate-500">Credentials stay protected and server-managed.</p></div>
          <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          {selected === 'PATHAO' ? <>
            <PathaoConfigurationCard status={data.pathao} />
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Read-only verification</p><h3 className="mt-1 font-semibold">Pathao API status</h3></div><ShieldCheck className="h-5 w-5 text-emerald-600" /></div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">{['authentication', 'store', 'city', 'price'].map((key) => <div key={key} className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{key === 'city' ? 'City / zone / area' : key}</p><p className="mt-1 font-semibold">{pathaoTest?.[key]?.status ?? persisted?.[key] ?? 'NOT TESTED'}</p></div>)}</div>
              <button type="button" onClick={verifyPathao} disabled={isPending} className="mt-3 w-full rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{isPending ? 'Testing Pathao…' : 'Run read-only verification'}</button>
            </section>
          </> : selected === 'STEADFAST' ? (steadfastStatus ? <SteadfastConfigurationCard initialStatus={steadfastStatus} /> : <LoadingCard />) : selected === 'REDX' ? (redxStatus ? <RedxConfigurationCard initialStatus={redxStatus} /> : <LoadingCard />) : <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-900">Configuration interface not enabled yet</p><p className="mt-1 text-xs leading-5 text-slate-500">This provider stays visible for network planning until its official production API contract is implemented.</p></section>}
        </div>
      </section>
    </div> : null}
  </>
}

function LoadingCard() {
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center"><p className="text-sm font-semibold">Loading provider configuration…</p><p className="mt-1 text-xs text-slate-500">Fetching protected configuration status.</p></section>
}
