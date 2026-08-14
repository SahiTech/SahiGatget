import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

import { Breadcrumbs } from '@/components/storefront/page-intro'

export type PolicySection = {
  id: string
  title: string
  body?: string
  paragraphs?: string[]
  bullets?: string[]
}

export function PolicyPage({
  eyebrow,
  title,
  description,
  sections,
  relatedLinks = [],
  aside,
}: {
  eyebrow: string
  title: string
  description: string
  sections: PolicySection[]
  relatedLinks?: { label: string; href: string }[]
  aside?: React.ReactNode
}) {
  return (
    <main className="flex-1 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Help & Policies', href: '/help' }, { label: title, href: `#${sections[0]?.id ?? 'top'}` }]} />
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
          <article className="min-w-0">
            <header className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">{eyebrow}</p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">{title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">{description}</p>
            </header>

            <div className="mt-6 space-y-5">
              {sections.map((section) => (
                <section id={section.id} key={section.id} className="scroll-mt-24 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{section.title}</h2>
                  {section.body && <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{section.body}</p>}
                  {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{paragraph}</p>)}
                  {section.bullets && (
                    <ul className="mt-4 grid gap-3 text-sm leading-7 text-slate-600 sm:text-base">
                      {section.bullets.map((bullet) => <li key={bullet} className="flex items-start gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /><span>{bullet}</span></li>)}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </article>

          <aside className="lg:sticky lg:top-24">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">On this page</p>
              <nav className="mt-4 grid gap-2" aria-label={`${title} sections`}>
                {sections.map((section) => <a key={section.id} href={`#${section.id}`} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-slate-950">{section.title}</a>)}
              </nav>
            </div>
            {aside}
          </aside>
        </div>

        {relatedLinks.length > 0 && (
          <nav className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Related customer care pages">
            {relatedLinks.map((link) => <Link key={link.href} href={link.href} className="group flex min-h-12 items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-slate-950"><span>{link.label}</span><ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" /></Link>)}
          </nav>
        )}
      </div>
    </main>
  )
}
