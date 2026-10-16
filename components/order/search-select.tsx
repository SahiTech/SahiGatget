'use client'

import { useId, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

type SearchSelectProps = { label: string; value: string; options: readonly string[]; placeholder: string; disabled?: boolean; error?: string; id?: string; autoComplete?: string; accent?: 'orange' | 'emerald'; onChange: (value: string) => void }

export function SearchSelect({ label, value, options, placeholder, disabled = false, error, id, autoComplete, accent = 'orange', onChange }: SearchSelectProps) {
  const generatedId = useId()
  const buttonId = id ?? generatedId
  const errorId = `${buttonId}-error`
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filtered = options.filter((option) => option.toLowerCase().includes(search.trim().toLowerCase()))
  const focusClasses = accent === 'emerald' ? 'focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100' : 'focus:border-[var(--brand-orange)] focus:ring-4 focus:ring-orange-100'
  const activeClasses = accent === 'emerald' ? 'bg-emerald-50 font-black text-emerald-700' : 'bg-orange-50 font-black text-orange-700'

  return <div className="relative min-w-0">
    <span id={`${buttonId}-label`} className="text-xs font-black text-slate-800">{label}</span>
    <button id={buttonId} type="button" role="combobox" aria-controls={`${buttonId}-listbox`} disabled={disabled} aria-labelledby={`${buttonId}-label`} aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} aria-expanded={open} aria-haspopup="listbox" onClick={() => { setOpen((current) => !current); setSearch('') }} className={`mt-1.5 flex h-12 w-full items-center justify-between rounded-xl border bg-white px-3.5 text-left text-sm outline-none ${focusClasses} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${error ? 'border-rose-400' : 'border-slate-200'}`}>
      <span className={value ? 'font-semibold text-slate-950' : 'text-slate-400'}>{value || placeholder}</span><ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
    </button>
    {open && !disabled && <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3"><Search className="h-4 w-4 text-slate-400" aria-hidden="true" /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }} placeholder="খুঁজুন..." autoComplete={autoComplete ?? 'off'} aria-label={`${label} খুঁজুন`} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
      <div id={`${buttonId}-listbox`} role="listbox" aria-labelledby={`${buttonId}-label`} className="max-h-52 overflow-y-auto p-1.5">
        {filtered.length ? filtered.map((option) => <button key={option} type="button" role="option" aria-selected={option === value} onClick={() => { onChange(option); setOpen(false); setSearch('') }} className={`flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm ${option === value ? activeClasses : 'text-slate-700 hover:bg-slate-50'}`}>{option}</button>) : <p className="px-3 py-4 text-xs text-slate-500">মিল পাওয়া যায়নি।</p>}
      </div>
    </div>}
    {error && <span id={errorId} className="mt-1 block text-[11px] font-bold text-rose-600">{error}</span>}
  </div>
}
