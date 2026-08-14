import type { Metadata } from 'next'
import { Mail, MessageSquareText, Phone, UserRound } from 'lucide-react'

import { AdminPageHeader, AdminShell } from '@/components/admin/admin-shell'
import { getAdminSession } from '@/lib/admin/auth'
import { getSupportRequests, updateSupportRequest } from '@/lib/support/actions'

export const metadata: Metadata = { title: 'Customer Support | SahiGadget Admin' }

const statusOptions = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const

function statusClass(status: string) {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'bg-emerald-50 text-emerald-700'
  if (status === 'IN_PROGRESS') return 'bg-amber-50 text-amber-700'
  return 'bg-sky-50 text-sky-700'
}

export default async function AdminSupportPage() {
  const session = await getAdminSession()
  if (!session) return null
  const requests = await getSupportRequests()
  return (
    <AdminShell session={session}>
      <AdminPageHeader eyebrow="Customer care" title="Customer Support" description="Review incoming support requests, contact customers, and update request status. Only signed-in SahiGadget administrators can access these records." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">All requests</p><p className="mt-2 text-3xl font-black text-slate-950">{requests.length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">New</p><p className="mt-2 text-3xl font-black text-sky-700">{requests.filter((item) => item.status === 'NEW').length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">In progress</p><p className="mt-2 text-3xl font-black text-amber-700">{requests.filter((item) => item.status === 'IN_PROGRESS').length}</p></div>
      </div>
      {requests.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><MessageSquareText className="mx-auto h-10 w-10 text-emerald-600" /><h2 className="mt-4 text-lg font-black text-slate-950">No support requests yet</h2><p className="mt-2 text-sm text-slate-600">New customer messages will appear here after they submit the public support form.</p></div> : <div className="grid gap-5">{requests.map((request) => <article key={request.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(request.status)}`}>{request.status.replace('_', ' ')}</span><time className="text-xs text-slate-500" dateTime={request.created_at}>{new Date(request.created_at).toLocaleString('en-BD')}</time></div><h2 className="mt-3 text-xl font-black text-slate-950">{request.subject}</h2><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600"><span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4 text-emerald-600" />{request.full_name}</span><a className="inline-flex items-center gap-2 hover:text-slate-950" href={`tel:${request.phone.replace(/\s+/g, '')}`}><Phone className="h-4 w-4 text-emerald-600" />{request.phone}</a><a className="inline-flex items-center gap-2 break-all hover:text-slate-950" href={`mailto:${request.email}`}><Mail className="h-4 w-4 text-emerald-600" />{request.email}</a>{request.order_number && <span className="text-xs font-bold text-slate-500">Order: {request.order_number}</span>}</div></div>
          <form action={updateSupportRequest} className="grid w-full gap-3 rounded-2xl bg-slate-50 p-4 lg:max-w-xs"><input type="hidden" name="id" value={request.id} /><label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Status<select name="status" defaultValue={request.status} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold tracking-normal text-slate-900"><option value="NEW">New</option>{statusOptions.slice(1).map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></label><label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Internal notes<textarea name="admin_notes" defaultValue={request.admin_notes ?? ''} rows={2} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal tracking-normal text-slate-900" placeholder="Optional internal note" /></label><button type="submit" className="min-h-10 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-emerald-700">Save update</button></form>
        </div>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Customer message</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{request.message}</p></div>
      </article>)}</div>}
    </AdminShell>
  )
}
