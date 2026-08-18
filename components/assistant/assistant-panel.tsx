'use client'

/* Dynamic Supabase Storage URLs are rendered directly; remote image domains are intentionally not hard-coded. */
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowUp, Bot, Loader2, X } from 'lucide-react'

import type { AssistantResponse } from '@/lib/assistant/contracts'

type Message = { role: 'user' | 'assistant'; content: string; response?: AssistantResponse }

const defaultPrompts = ['একটি পণ্য খুঁজে দিন', 'বাজেটের মধ্যে ফোন দেখান', 'ডেলিভারি সম্পর্কে জানতে চাই', 'ওয়ারেন্টি সম্পর্কে জানতে চাই']

function getSessionId() {
  const key = 'sahigadget-assistant-session'
  const existing = window.sessionStorage.getItem(key)
  if (existing) return existing
  const value = `${crypto.randomUUID().replaceAll('-', '')}`
  window.sessionStorage.setItem(key, value)
  return value
}

export default function AssistantPanel({ onClose, assistantName = 'SahiGadget Assistant', maintenanceMode = false, maintenanceMessage, maxVisibleProductCards = 4, showQuickPrompts = true, welcomeMessage, quickPrompts }: { onClose: () => void; assistantName?: string; maintenanceMode?: boolean; maintenanceMessage?: string; maxVisibleProductCards?: number; showQuickPrompts?: boolean; welcomeMessage?: string; quickPrompts?: string[] }) {
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [onClose])

  const conversation = useMemo(() => messages.slice(-6).map(({ role, content }) => ({ role, content })), [messages])

  async function submit(message = input) {
    const trimmed = message.trim()
    if (!trimmed || loading || maintenanceMode) return
    setInput('')
    setError('')
    setMessages((current) => [...current, { role: 'user', content: trimmed }])
    setLoading(true)
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, conversation, sessionId: getSessionId(), locale: 'auto', pageContext: { pathname: window.location.pathname } }),
      })
      const payload = await response.json() as AssistantResponse | { error?: { message?: string } }
      if (!response.ok || !('answer' in payload)) throw new Error(('error' in payload ? payload.error?.message : undefined) || 'সাময়িক সমস্যা হয়েছে।')
      setMessages((current) => [...current, { role: 'assistant', content: payload.answer, response: payload }])
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'সাময়িক সমস্যা হয়েছে। আবার চেষ্টা করুন।')
    } finally {
      setLoading(false)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  return (
    <div id="sahigadget-assistant-panel" ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby={titleId} className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex max-h-[min(70vh,620px)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)] sm:inset-x-auto sm:right-4 sm:w-[min(390px,calc(100vw-2rem))] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 motion-reduce:animate-none">
      <header className="flex items-center justify-between border-b border-slate-100 bg-slate-950 px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-teal-500/20 text-teal-200"><Bot aria-hidden="true" className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-sm font-semibold">{assistantName}</h2>
            <p className="text-xs text-slate-300">বাংলায় পণ্য ও স্টোর সহায়তা</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="সহকারী বন্ধ করুন" className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"><X aria-hidden="true" className="h-5 w-5" /></button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">{maintenanceMode ? <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-900">{maintenanceMessage || 'সহকারীটি বর্তমানে সাময়িকভাবে বন্ধ আছে।'}</div> : null}
        {messages.length === 0 ? <div className="space-y-4"><p className="text-sm leading-6 text-slate-700">{welcomeMessage || 'হ্যালো। আমি SahiGadget-এর প্রকাশ্য পণ্য, মূল্য, প্রাপ্যতা, ডেলিভারি ও ওয়ারেন্টি তথ্য খুঁজে দিতে পারি।'}</p>{showQuickPrompts ? <div className="grid gap-2">{(quickPrompts?.length ? quickPrompts : defaultPrompts).map((prompt) => <button type="button" key={prompt} onClick={() => submit(prompt)} disabled={maintenanceMode} className="rounded-2xl border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:border-teal-400 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">{prompt}</button>)}</div> : null}</div> : null}
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'ml-8 rounded-2xl rounded-br-md bg-teal-700 px-3 py-2.5 text-sm leading-6 text-white' : 'mr-4 space-y-3 rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2.5 text-sm leading-6 text-slate-800'}><p className="whitespace-pre-wrap">{message.content}</p>{message.response?.products.length ? <div className="grid gap-2">{message.response.products.slice(0, maxVisibleProductCards).map((product) => <Link key={product.id} href={product.href} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 transition hover:border-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">{product.imageUrl ? <img src={product.imageUrl} alt={product.imageAlt} className="h-full w-full object-cover" loading="lazy" /> : null}</div><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-900">{product.name}</p><p className="text-xs font-medium text-teal-700">{product.price === null ? 'মূল্য যাচাই করুন' : `৳${new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(product.price)}`}</p><p className="text-[11px] text-slate-500">{product.availability === 'in_stock' ? 'স্টকে আছে' : product.availability === 'low_stock' ? 'কম স্টক' : 'স্টকে নেই'}</p></div></Link>)}</div> : null}</div>)}
        {loading ? <div className="mr-12 flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2.5 text-sm text-slate-600"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />উত্তর প্রস্তুত করা হচ্ছে…</div> : null}
        {error ? <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{error}</p> : null}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void submit() }} className="border-t border-slate-100 p-3"><label htmlFor={`${titleId}-input`} className="sr-only">আপনার প্রশ্ন</label><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100"><input ref={inputRef} id={`${titleId}-input`} value={input} onChange={(event) => setInput(event.target.value.slice(0, 800))} maxLength={800} disabled={loading || maintenanceMode} placeholder="আপনার প্রশ্ন লিখুন…" className="min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-900 outline-none placeholder:text-slate-400" /><button type="submit" disabled={loading || maintenanceMode || !input.trim()} aria-label="প্রশ্ন পাঠান" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-700 text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp aria-hidden="true" className="h-5 w-5" /></button></div><p className="mt-2 text-[11px] text-slate-400">ব্যক্তিগত অর্ডার, পেমেন্ট বা ঠিকানার তথ্য পাঠাবেন না।</p></form>
    </div>
  )
}
