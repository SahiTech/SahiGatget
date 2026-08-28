'use client'

import { useEffect, useState, useTransition } from 'react'
import { ChevronDown, Settings2, ShieldCheck, Truck, X } from 'lucide-react'

import { testPathaoConnectionAction } from '@/lib/admin/delivery-actions'
import { getSteadfastConfigurationStatusAction } from '@/lib/admin/steadfast-actions'
import { getRedxConfigurationStatusAction } from '@/lib/admin/redx-actions'
import { PathaoConfigurationCard } from './pathao-configuration-card'
import { RedxConfigurationCard } from './redx-configuration-card'
import { SteadfastConfigurationCard } from './steadfast-configuration-card'

type ProviderStatus = 'VERIFIED' | 'NOT CONFIGURED' | 'API UNVERIFIED'

type ProviderMetadata = {
  last_connection_test?: Record<string, string | undefined>
}

type Provider = {
  provider: string
  display_name: string
  connection_state?: string | null
  is_enabled?: boolean
  credentialsRequired?: boolean
  readiness?: string | null
  catalogCapabilities?: string[]
  metadata?: ProviderMetadata
}

type PathaoConfigurationStatus = Parameters<typeof PathaoConfigurationCard>[0]['status']
export type DeliveryProviderNetworkData = {
  providers: Provider[]
  pathao: PathaoConfigurationStatus
}

type Props = { data: DeliveryProviderNetworkData }
type PathaoTestResult = Awaited<ReturnType<typeof testPathaoConnectionAction>>
type SteadfastStatus = Awaited<ReturnType<typeof getSteadfastConfigurationStatusAction>>
type RedxStatus = Awaited<ReturnType<typeof getRedxConfigurationStatusAction>>

type ConfigurationProvider = 'PATHAO' | 'STEADFAST' | 'REDX'

const capabilityLabels: Record<string, string> = {
  CREATE_SHIPMENT: 'Shipment',
  TRACK_SHIPMENT: 'Tracking',
  WEBHOOK: 'Webhooks',
  GET_BALANCE: 'Balance',
}

const pathaoVerificationKeys = ['authentication', 'store', 'city', 'zone', 'area', 'price'] as const

function getStatus(provider: Provider, pathaoVerified: boolean): ProviderStatus {
  if (provider.provider === 'PATHAO') {
    return pathaoVerified ? 'VERIFIED' : provider.credentialsRequired ? 'NOT CONFIGURED' : 'API UNVERIFIED'
  }

  if (provider.readiness === 'NOT_IMPLEMENTED') return 'API UNVERIFIED'

  return provider.connection_state === 'CONNECTED' && provider.is_enabled
    ? 'VERIFIED'
    : provider.credentialsRequired
      ? 'NOT CONFIGURED'
      : 'API UNVERIFIED'
}

function statusClass(status: ProviderStatus) {
  if (status === 'VERIFIED') return 'bg-emerald-100 text-emerald-800'
  if (status === 'NOT CONFIGURED') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

function statusDot(status: ProviderStatus) {
  if (status === 'VERIFIED') return 'bg-emerald-500'
  if (status === 'NOT CONFIGURED') return 'bg-amber-500'
  return 'bg-slate-400'
}

function providerCapabilityLabel(capability: string) {
  return capabilityLabels[capability] ?? capability.replaceAll('_', ' ')
}

export function DeliveryProviderNetwork({ data }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<ConfigurationProvider | null>(null)
  const [pathaoTest, setPathaoTest] = useState<PathaoTestResult | null>(null)
  const [steadfastStatus, setSteadfastStatus] = useState<SteadfastStatus | null>(null)
  const [redxStatus, setRedxStatus] = useState<RedxStatus | null>(null)
  const [isPending, startTransition] = useTransition()

  const pathaoProvider = data.providers.find((provider) => provider.provider === 'PATHAO')
  const persistedPathao = pathaoProvider?.metadata?.last_connection_test
  const pathaoVerified = pathaoVerificationKeys.every((key) => persistedPathao?.[key] === 'PASS')
  const selectedProvider = data.providers.find((provider) => provider.provider === selected)

  useEffect(() => {
    if (!selected) return

    if (selected === 'STEADFAST') {
      void getSteadfastConfigurationStatusAction()
        .then(setSteadfastStatus)
        .catch(() => setSteadfastStatus(null))
    }

    if (selected === 'REDX') {
      void getRedxConfigurationStatusAction()
        .then(setRedxStatus)
        .catch(() => setRedxStatus(null))
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selected])

  function verifyPathao() {
    startTransition(async () => {
      setPathaoTest(await testPathaoConnectionAction())
    })
  }

  return (
    <>
      <section className="delivery-provider-network overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls="delivery-provider-list"
          className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-slate-50"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Truck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Delivery network</p>
              <h2 className="mt-0.5 truncate text-base font-semibold text-slate-950">Courier integrations</h2>
              <p className="mt-0.5 text-xs text-slate-500">Production connections stay inside Configure.</p>
            </div>
          </div>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-4 pb-4 pt-3" aria-label="Courier connection summary">
          {data.providers.map((provider) => {
            const status = getStatus(provider, pathaoVerified)
            return (
              <span
                key={provider.provider}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`} aria-hidden="true" />
                {provider.display_name} · {status}
              </span>
            )
          })}
        </div>

        {expanded ? (
          <div id="delivery-provider-list" className="border-t border-slate-100 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {data.providers.map((provider) => {
                const status = getStatus(provider, pathaoVerified)
                return (
                  <article key={provider.provider} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black text-slate-700 ring-1 ring-slate-200">
                          {provider.display_name.slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-slate-950">{provider.display_name}</h3>
                          <p className="text-[11px] text-slate-500">Production API</p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${statusClass(status)}`}>
                        {status}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(provider.catalogCapabilities ?? []).map((capability) => (
                        <span key={capability} className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                          {providerCapabilityLabel(capability)}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-500">
                        {status === 'VERIFIED'
                          ? 'Live API verified'
                          : provider.readiness === 'NOT_IMPLEMENTED'
                            ? 'Runtime not enabled'
                            : 'Configuration required'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (provider.provider === 'PATHAO' || provider.provider === 'STEADFAST' || provider.provider === 'REDX') {
                            setSelected(provider.provider)
                          }
                        }}
                        disabled={!['PATHAO', 'STEADFAST', 'REDX'].includes(provider.provider)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-950 px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                      >
                        <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Configure
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        ) : null}
      </section>

      {selected ? (
        <div
          className="fixed inset-0 z-[60] flex justify-end bg-slate-950/40 p-0 sm:p-4"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delivery-provider-title"
            className="h-full w-full max-w-xl overflow-y-auto bg-slate-50 shadow-2xl sm:rounded-2xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Provider configuration</p>
                <h2 id="delivery-provider-title" className="mt-1 text-xl font-semibold text-slate-950">
                  {selectedProvider?.display_name ?? selected}
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Credentials stay protected and server-managed.</p>
              </div>
              <button
                type="button"
                aria-label="Close provider configuration"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {selected === 'PATHAO' ? (
                <>
                  <PathaoConfigurationCard status={data.pathao} />
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Read-only verification</p>
                        <h3 className="mt-1 font-semibold">Pathao API status</h3>
                      </div>
                      <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      {(['authentication', 'store', 'city', 'price'] as const).map((key) => (
                        <div key={key} className="rounded-xl bg-slate-50 p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            {key === 'city' ? 'City / zone / area' : key}
                          </p>
                          <p className="mt-1 font-semibold">
                            {pathaoTest?.[key]?.status ?? persistedPathao?.[key] ?? 'NOT TESTED'}
                          </p>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={verifyPathao}
                      disabled={isPending}
                      className="mt-3 w-full rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    >
                      {isPending ? 'Testing Pathao…' : 'Run read-only verification'}
                    </button>
                  </section>
                </>
              ) : selected === 'STEADFAST' ? (
                steadfastStatus ? <SteadfastConfigurationCard initialStatus={steadfastStatus} /> : <LoadingCard />
              ) : redxStatus ? (
                <RedxConfigurationCard initialStatus={redxStatus} />
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

function LoadingCard() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center" role="status" aria-live="polite">
      <p className="text-sm font-semibold">Loading provider configuration…</p>
      <p className="mt-1 text-xs text-slate-500">Fetching protected configuration status.</p>
    </section>
  )
}
