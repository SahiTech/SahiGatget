'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Activity, AlertTriangle, BarChart3, Bot, CheckCircle2, Clock3, Database, Gauge, Save, Settings2, ShieldCheck, SlidersHorizontal } from 'lucide-react'

import { saveAIConfigurationAction, saveAssistantControls, saveAssistantPolicy, testAIConfigurationAction, toggleAIConfigurationAction } from '@/lib/admin/assistant-actions'
import type { AssistantControlConfig, AssistantPolicyConfig } from '@/lib/assistant/config'

type Props = {
  config: AssistantControlConfig
  policy: AssistantPolicyConfig
  configurationStatus: {
    enabled: boolean
    providerConfigured: boolean
    rateLimitConfigured: boolean
    rateLimit: { maxRequestsPerWindow: number; windowSeconds: number }
    dailyRequestBudget: number
    secretsStoredInSettings: boolean
    providerSource: 'ADMIN' | 'ENV' | 'NONE'
    provider: string | null
    apiUrl: string | null
    model: string | null
    apiKeyConfigured: boolean
    maskedApiKey: string | null
    adminConfigExists: boolean
    adminConfigEnabled: boolean | null
  }
  analytics: {
    totalRequests: number
    averageLatencyMs: number
    answeredRequests: number
    unansweredRequests: number
    rateLimitedRequests: number
    errors: number
    byIntent: Array<{ intent: string; count: number }>
    unansweredPatterns: Array<{ pattern: string; count: number }>
    range: 'today' | '7d' | '30d'
    page: number
    pageSize: number
    totalEvents: number
    totalPages: number
    hasPrevious: boolean
    hasNext: boolean
    recentEvents: Array<{ id: string; action: string; createdAt: string; details: unknown }>
  }
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{label}</span>
}

export function AssistantControlCenter({ config: initialConfig, policy: initialPolicy, configurationStatus, analytics }: Props) {
  const [config, setConfig] = useState(initialConfig)
  const [policy, setPolicy] = useState(initialPolicy)
  const [notice, setNotice] = useState('')
  const [isPending, startTransition] = useTransition()
  const [providerPending, startProviderTransition] = useTransition()
  const [providerOpen, setProviderOpen] = useState(false)
  const [providerNotice, setProviderNotice] = useState('')
  const [providerForm, setProviderForm] = useState({ provider: configurationStatus.provider ?? 'OPENAI_COMPATIBLE', apiUrl: configurationStatus.apiUrl ?? '', apiKey: '', model: configurationStatus.model ?? '', enabled: configurationStatus.adminConfigEnabled ?? true })
  const updateProvider = (key: 'provider' | 'apiUrl' | 'apiKey' | 'model' | 'enabled', value: string | boolean) => setProviderForm((current) => ({ ...current, [key]: value }))
  function testProvider() {
    setProviderNotice('')
    startProviderTransition(async () => setProviderNotice((await testAIConfigurationAction(providerForm)).message))
  }
  function saveProvider() {
    setProviderNotice('')
    startProviderTransition(async () => {
      const result = await saveAIConfigurationAction(providerForm)
      setProviderNotice(result.message)
      if (result.ok) window.location.reload()
    })
  }
  function toggleProvider() {
    const enabled = !providerForm.enabled
    updateProvider('enabled', enabled)
    startProviderTransition(async () => setProviderNotice((await toggleAIConfigurationAction(enabled)).message))
  }
  const updateConfig = <K extends keyof AssistantControlConfig>(key: K, value: AssistantControlConfig[K]) => setConfig((current) => ({ ...current, [key]: value }))
  const updatePolicy = <K extends keyof AssistantPolicyConfig>(key: K, value: AssistantPolicyConfig[K]) => setPolicy((current) => ({ ...current, [key]: value }))

  function submitControls() {
    setNotice('')
    startTransition(async () => setNotice((await saveAssistantControls(config)).message))
  }
  function submitPolicy() {
    setNotice('')
    startTransition(async () => setNotice((await saveAssistantPolicy(policy)).message))
  }

  return <div className="space-y-6">
    {notice ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}
    <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">AI Assistant</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Provider configuration</h2><p className="mt-1 text-sm text-slate-500">Admin configuration takes priority over deployment fallback. Secrets remain server-side.</p><p className="mt-2 text-xs text-slate-500">Source: {configurationStatus.providerSource} · {configurationStatus.provider ?? 'No provider'} · {configurationStatus.model ?? 'No model'} · Key: {configurationStatus.maskedApiKey ?? 'Not configured'}</p></div><div className="flex items-center gap-2"><StatusPill ok={configurationStatus.providerConfigured} label={configurationStatus.providerConfigured ? 'Configured' : 'Not configured'} /><button type="button" onClick={() => setProviderOpen((open) => !open)} aria-expanded={providerOpen} aria-controls="ai-provider-configuration" aria-label="Open AI provider configuration" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"><Settings2 className="h-4 w-4" /></button></div></div>{providerOpen ? <div id="ai-provider-configuration" role="dialog" aria-label="AI provider configuration" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-600">Provider<select value={providerForm.provider} onChange={(event) => updateProvider('provider', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="OPENAI_COMPATIBLE">OpenAI-compatible</option><option value="OPENAI">OpenAI</option><option value="GEMINI">Gemini-compatible endpoint</option></select></label><label className="text-sm text-slate-600">Model<input value={providerForm.model} onChange={(event) => updateProvider('model', event.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="text-sm text-slate-600 sm:col-span-2">API Base URL<input type="url" value={providerForm.apiUrl} onChange={(event) => updateProvider('apiUrl', event.target.value)} placeholder="https://api.example.com/v1/chat/completions" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="text-sm text-slate-600 sm:col-span-2">API Key<input type="password" value={providerForm.apiKey} onChange={(event) => updateProvider('apiKey', event.target.value)} placeholder={configurationStatus.apiKeyConfigured ? 'Encrypted key stored; leave blank to preserve it' : 'Enter provider API key'} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label></div><label className="mt-4 flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={providerForm.enabled} onChange={(event) => updateProvider('enabled', event.target.checked)} className="h-4 w-4 accent-teal-700" />Enable Admin provider configuration</label>{providerNotice ? <p role="status" className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">{providerNotice}</p> : null}<div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={testProvider} disabled={providerPending} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-teal-300 disabled:opacity-50">{providerPending ? 'Working…' : 'Test Connection'}</button><button type="button" onClick={saveProvider} disabled={providerPending} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"><Save className="h-4 w-4" />Save</button>{configurationStatus.adminConfigExists ? <button type="button" onClick={toggleProvider} disabled={providerPending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{providerForm.enabled ? 'Disable' : 'Enable'}</button> : null}</div></div> : null}</section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><Bot className="h-5 w-5 text-teal-700" /><StatusPill ok={configurationStatus.enabled} label={configurationStatus.enabled ? 'Enabled' : 'Disabled'} /></div><p className="mt-3 text-2xl font-bold text-slate-950">{analytics.totalRequests}</p><p className="text-sm text-slate-500">Requests recorded</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><Clock3 className="h-5 w-5 text-teal-700" /><span className="text-xs text-slate-500">p50 sample</span></div><p className="mt-3 text-2xl font-bold text-slate-950">{analytics.averageLatencyMs}ms</p><p className="text-sm text-slate-500">Average response latency</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><ShieldCheck className="h-5 w-5 text-teal-700" /><StatusPill ok={configurationStatus.rateLimitConfigured} label={configurationStatus.rateLimitConfigured ? 'Protected' : 'Not configured'} /></div><p className="mt-3 text-2xl font-bold text-slate-950">{analytics.rateLimitedRequests}</p><p className="text-sm text-slate-500">Rate-limited requests</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><Activity className="h-5 w-5 text-teal-700" /><StatusPill ok={configurationStatus.providerConfigured} label={configurationStatus.providerConfigured ? 'Provider ready' : 'Provider missing'} /></div><p className="mt-3 text-2xl font-bold text-slate-950">{analytics.errors}</p><p className="text-sm text-slate-500">Recorded runtime errors</p></div>
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-950">Feature controls</h2><p className="mt-1 text-sm text-slate-500">These controls affect only the public assistant runtime. Provider secrets are never stored here.</p></div><SlidersHorizontal className="h-5 w-5 text-teal-700" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {([['enabled', 'Enable public assistant'], ['maintenanceMode', 'Maintenance mode'], ['allowProductSearch', 'Allow product search'], ['allowPolicyQuestions', 'Allow policy questions'], ['allowRecommendations', 'Allow recommendations'], ['showQuickPrompts', 'Show quick prompts']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" checked={config[key] as boolean} onChange={(event) => updateConfig(key, event.target.checked as AssistantControlConfig[typeof key])} className="h-4 w-4 accent-teal-700" />{label}</label>)}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-600">Assistant name<input value={config.assistantName} onChange={(event) => updateConfig('assistantName', event.target.value)} maxLength={80} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-sm text-slate-600">Floating button label<input value={config.buttonLabel} onChange={(event) => updateConfig('buttonLabel', event.target.value)} maxLength={80} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-600">Maintenance message<textarea value={config.maintenanceMessage} onChange={(event) => updateConfig('maintenanceMessage', event.target.value)} maxLength={300} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-sm text-slate-600">Maximum product cards<select value={config.maxVisibleProductCards} onChange={(event) => updateConfig('maxVisibleProductCards', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">{[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-sm text-slate-600">Default language<select value={config.defaultLanguage} onChange={(event) => updateConfig('defaultLanguage', event.target.value as AssistantControlConfig['defaultLanguage'])} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="bn">Bengali</option><option value="auto">Auto</option><option value="en">English</option></select></label><label className="text-sm text-slate-600">Requests per window<input type="number" min={1} max={100} value={config.maxRequestsPerWindow} onChange={(event) => updateConfig('maxRequestsPerWindow', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-sm text-slate-600">Window seconds<input type="number" min={60} max={3600} value={config.rateLimitWindowSeconds} onChange={(event) => updateConfig('rateLimitWindowSeconds', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label></div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Runtime controls</p><div className="mt-3 grid gap-4 sm:grid-cols-3"><label className="text-sm text-slate-600">Temperature<input type="number" min={0} max={1} step={0.1} value={config.temperature} onChange={(event) => updateConfig('temperature', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="text-sm text-slate-600">Max tokens<input type="number" min={64} max={2000} value={config.maxTokens} onChange={(event) => updateConfig('maxTokens', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="text-sm text-slate-600">Request timeout (ms)<input type="number" min={1000} max={15000} value={config.requestTimeoutMs} onChange={(event) => updateConfig('requestTimeoutMs', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label></div><p className="mt-2 text-xs text-slate-500">Validated runtime controls used by the existing provider adapter. Retry and fallback-provider controls are not exposed because the current architecture has no explicit fallback adapter.</p></div>
        <label className="mt-4 block text-sm text-slate-600">Welcome message<textarea value={config.welcomeMessage} onChange={(event) => updateConfig('welcomeMessage', event.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        <label className="mt-4 block text-sm text-slate-600">Quick prompts, one per line<textarea value={config.quickPrompts.join('\n')} onChange={(event) => updateConfig('quickPrompts', event.target.value.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 6))} rows={4} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        <button type="button" onClick={submitControls} disabled={isPending} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"><Save className="h-4 w-4" />{isPending ? 'Saving…' : 'Save controls'}</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-950">Runtime health</h2><p className="mt-1 text-sm text-slate-500">Read-only readiness signals. Secret values are never displayed.</p></div><Gauge className="h-5 w-5 text-teal-700" /></div><div className="space-y-3 text-sm"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-slate-600">LLM provider configuration</span><StatusPill ok={configurationStatus.providerConfigured} label={configurationStatus.providerConfigured ? 'Ready' : 'Missing'} /></div><div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-slate-600">Distributed rate limiting</span><StatusPill ok={configurationStatus.rateLimitConfigured} label={configurationStatus.rateLimitConfigured ? 'Ready' : 'Missing'} /></div><div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-slate-600">Settings secret storage</span><StatusPill ok={!configurationStatus.secretsStoredInSettings} label="Protected" /></div><div className="flex items-center justify-between"><span className="text-slate-600">Daily request budget</span><span className="font-semibold text-slate-900">{configurationStatus.dailyRequestBudget}</span></div></div><div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Production remains fail-closed until the provider and distributed limiter are configured in the authorized Vercel project.</div></div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-950">Assistant policy editor</h2><p className="mt-1 text-sm text-slate-500">Blank fields use the canonical public policy sources. Overrides are for assistant wording only and never alter checkout or store policy pages.</p></div><Database className="h-5 w-5 text-teal-700" /></div><div className="grid gap-4 md:grid-cols-2">{([['delivery', 'Delivery'], ['warranty', 'Warranty'], ['returns', 'Returns and replacements'], ['cod', 'Cash on Delivery'], ['support', 'Support'], ['storeInformation', 'Store information']] as const).map(([key, label]) => <label key={key} className="text-sm text-slate-600">{label}<textarea value={policy[key]} onChange={(event) => updatePolicy(key, event.target.value)} maxLength={3000} rows={4} placeholder="Leave blank to use the canonical public source." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>)}</div><button type="button" onClick={submitPolicy} disabled={isPending} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Save className="h-4 w-4" />{isPending ? 'Saving…' : 'Save policy sources'}</button></section>

    <section className="grid gap-6 xl:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-teal-700" /><h2 className="text-lg font-semibold text-slate-950">Intent analytics</h2></div><div className="flex gap-1 text-xs"><Link href="/admin/ai-assistant?range=today&page=1" className={`rounded-lg px-2 py-1 ${analytics.range === 'today' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'}`}>Today</Link><Link href="/admin/ai-assistant?range=7d&page=1" className={`rounded-lg px-2 py-1 ${analytics.range === '7d' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'}`}>7 days</Link><Link href="/admin/ai-assistant?range=30d&page=1" className={`rounded-lg px-2 py-1 ${analytics.range === '30d' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'}`}>30 days</Link></div></div><div className="space-y-2">{analytics.byIntent.length ? analytics.byIntent.map((item) => <div key={item.intent} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-600">{item.intent}</span><span className="font-semibold text-slate-900">{item.count}</span></div>) : <p className="text-sm text-slate-500">No assistant events recorded yet.</p>}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /><h2 className="text-lg font-semibold text-slate-950">Unanswered questions</h2></div><div className="space-y-2">{analytics.unansweredPatterns.length ? analytics.unansweredPatterns.map((item) => <div key={item.pattern} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm"><span className="truncate text-amber-900">{item.pattern}</span><span className="font-semibold text-amber-900">{item.count}</span></div>) : <p className="text-sm text-slate-500">No unanswered patterns recorded yet.</p>}</div></div></section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-950">Recent assistant audit events</h2><p className="mt-1 text-sm text-slate-500">Aggregate operational events only. Customer messages, IP addresses, session IDs, and private data are excluded.</p></div><div className="flex items-center gap-2 text-xs"><span className="text-slate-500">Page {analytics.page} of {analytics.totalPages}</span>{analytics.hasPrevious ? <Link href={`/admin/ai-assistant?range=${analytics.range}&page=${analytics.page - 1}`} className="rounded-lg bg-slate-100 px-2 py-1 text-slate-700">Previous</Link> : null}{analytics.hasNext ? <Link href={`/admin/ai-assistant?range=${analytics.range}&page=${analytics.page + 1}`} className="rounded-lg bg-slate-100 px-2 py-1 text-slate-700">Next</Link> : null}</div></div><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-2">Action</th><th className="px-3 py-2">Time</th><th className="px-3 py-2">Details</th></tr></thead><tbody>{analytics.recentEvents.slice(0, 25).map((event) => <tr key={event.id} className="border-b border-slate-100"><td className="px-3 py-2 font-medium text-slate-800">{event.action}</td><td className="px-3 py-2 text-slate-500">{new Date(event.createdAt).toLocaleString('en-BD')}</td><td className="max-w-md truncate px-3 py-2 text-xs text-slate-500">{JSON.stringify(event.details)}</td></tr>)}</tbody></table></div></section>
  </div>
}
