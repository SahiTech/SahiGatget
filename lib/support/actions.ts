'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin/auth'

export type SupportActionState = {
  ok: boolean
  message: string
  fieldErrors?: Record<string, string>
}

const EMPTY_STATE: SupportActionState = { ok: false, message: '' }
const recentSubmissions = new Map<string, number>()

function clean(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function submitSupportRequest(_previous: SupportActionState = EMPTY_STATE, formData: FormData): Promise<SupportActionState> {
  void _previous
  const honeypot = clean(formData.get('website'))
  if (honeypot) return { ok: true, message: 'Your support request has been received.' }

  const fullName = clean(formData.get('full_name'))
  const phone = clean(formData.get('phone'))
  const email = clean(formData.get('email')).toLowerCase()
  const subject = clean(formData.get('subject'))
  const message = clean(formData.get('message'))
  const orderNumber = clean(formData.get('order_number')) || null
  const fieldErrors: Record<string, string> = {}

  if (fullName.length < 2 || fullName.length > 120) fieldErrors.full_name = 'Please enter your full name.'
  if (phone.length < 7 || phone.length > 30) fieldErrors.phone = 'Please enter a valid phone number.'
  if (!validEmail(email) || email.length > 254) fieldErrors.email = 'Please enter a valid email address.'
  if (subject.length < 2 || subject.length > 160) fieldErrors.subject = 'Please add a short subject.'
  if (message.length < 10 || message.length > 5000) fieldErrors.message = 'Please describe your request in at least 10 characters.'
  if (Object.keys(fieldErrors).length > 0) return { ok: false, message: 'Please correct the highlighted fields.', fieldErrors }

  const requestHeaders = await headers()
  const fingerprint = `${requestHeaders.get('x-forwarded-for') ?? 'unknown'}:${email}:${phone}`
  const lastSubmitted = recentSubmissions.get(fingerprint) ?? 0
  if (Date.now() - lastSubmitted < 15_000) return { ok: false, message: 'Please wait a moment before sending another request.' }
  recentSubmissions.set(fingerprint, Date.now())

  const db = createAdminClient()
  const { error } = await db.from('customer_support_requests').insert({
    full_name: fullName,
    phone,
    email,
    subject,
    message,
    order_number: orderNumber,
  })

  if (error) {
    console.error('support_request_insert_failed', { code: error.code, message: error.message })
    return { ok: false, message: 'We could not send your request right now. Please email hello@sahigadget.shop or call +880 1601-654316.' }
  }

  return { ok: true, message: 'Your support request has been received. Our team will contact you shortly.' }
}

export async function getSupportRequests() {
  await requireAdmin(['OWNER', 'ADMIN', 'STAFF'])
  const db = createAdminClient()
  const { data, error } = await db
    .from('customer_support_requests')
    .select('id, full_name, phone, email, subject, message, order_number, status, admin_notes, created_at, updated_at, resolved_at, resolved_by')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function updateSupportRequest(formData: FormData) {
  const session = await requireAdmin(['OWNER', 'ADMIN', 'STAFF'])
  const id = clean(formData.get('id'))
  const status = clean(formData.get('status'))
  const adminNotes = clean(formData.get('admin_notes')) || null
  if (!id || !['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) throw new Error('Invalid support request update')

  const db = createAdminClient()
  const { error } = await db
    .from('customer_support_requests')
    .update({ status, admin_notes: adminNotes, resolved_by: ['RESOLVED', 'CLOSED'].includes(status) ? session.userId : null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/support')
}
