import Link from 'next/link'
import Image from 'next/image'
import { Archive, LogOut, ShieldCheck } from 'lucide-react'

import { signOutAdmin } from '@/lib/admin/actions'
import type { AdminSession } from '@/lib/admin/auth'
import { AdminMobileNav } from './admin-mobile-nav'
import { AdminNavigation } from './admin-navigation'

function SignOutControl() {
  return <form action={signOutAdmin}><button type="submit" className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-slate-300 transition hover:bg-rose-500/10 hover:text-rose-300"><LogOut className="h-4 w-4" />Sign out</button></form>
}

export function AdminShell({ session, children }: { session: AdminSession; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-950 p-5 text-white md:flex">
        <Link href="/admin" className="mb-9 flex items-center gap-3"><div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-slate-900 shadow-md"><Image src="/logo.png" alt="SahiGadget Logo" width={40} height={40} className="h-full w-full object-cover" /></div><span><span className="block text-sm font-bold tracking-wide">SahiGadget</span><span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Operations</span></span></Link>
        <AdminNavigation role={session.role} />
        <div className="mt-auto border-t border-slate-800 pt-4"><div className="mb-3 rounded-xl bg-slate-900 p-3"><p className="truncate text-sm font-semibold">{session.fullName}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-emerald-300">{session.role}</p></div><SignOutControl /></div>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <AdminMobileNav>
              <AdminNavigation role={session.role} />
              <div className="mt-3 border-t border-slate-800 pt-3">
                <SignOutControl />
              </div>
            </AdminMobileNav>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">SahiGadget administration</p>
              <p className="text-sm text-slate-500">Operational control center</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><ShieldCheck className="h-4 w-4" />{session.role}</div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}

export function AdminPageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p></div>{action}</div>
}

export function AdminEmptyState({ icon: Icon = Archive, title, description }: { icon?: typeof Archive; title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></div><h2 className="mt-4 text-lg font-semibold text-slate-900">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p></div>
}
