'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { MessageCircle } from 'lucide-react'

const AssistantPanel = dynamic(() => import('./assistant-panel'), { ssr: false })

export function AssistantButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label="SahiGadget Assistant খুলুন"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-[0_12px_32px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-[0_16px_38px_rgba(15,23,42,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 active:scale-[0.98] motion-reduce:transition-none"
      >
        <MessageCircle aria-hidden="true" className="h-5 w-5 text-teal-700" />
        <span>সাহায্য লাগবে?</span>
      </button>
      {open ? <AssistantPanel onClose={() => setOpen(false)} /> : null}
    </>
  )
}
