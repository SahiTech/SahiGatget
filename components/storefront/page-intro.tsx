import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export function Breadcrumbs({ items }: { items: { label: string; href: string }[] }) {
  return <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-400">{items.map((item, index) => <span key={`${item.href}-${item.label}`} className="flex items-center gap-1"><Link href={item.href} className="transition-colors hover:text-slate-950">{item.label}</Link>{index < items.length - 1 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}</span>)}</nav>
}

export function PageIntro({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <section className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:flex-row lg:items-end lg:justify-between lg:px-8"><div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">{eyebrow}</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">{title}</h1><p className="mt-4 max-w-xl text-base leading-7 text-slate-500">{description}</p></div>{children && <div className="shrink-0">{children}</div>}</div></section>
}
