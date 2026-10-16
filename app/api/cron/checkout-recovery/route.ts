import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordCommerceEvent } from '@/lib/analytics/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  if (!secret || !header.startsWith('Bearer ')) return false
  const expected = createHash('sha256').update(secret).digest()
  const received = createHash('sha256').update(header.slice(7)).digest()
  return timingSafeEqual(expected, received) && header.slice(7).length === secret.length
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  const cutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString()
  const now = new Date().toISOString()
  const { data: rows, error } = await db.from('checkout_sessions')
    .select('id,checkout_request_id,cart_id,source,status,completed_order_id,expires_at,recovery_consent_at,recovery_consent_withdrawn_at')
    .in('status', ['STARTED','DETAILS_ENTERED','QUOTED'])
    .lt('last_activity_at', cutoff).gt('expires_at', now)
    .order('last_activity_at', { ascending: true }).limit(100)
  if (error) return NextResponse.json({ error: 'Unable to process checkout sessions' }, { status: 500 })
  let marked = 0
  for (const session of rows ?? []) {
    if (session.completed_order_id) continue
    const { data: orders, error: orderLookupError } = await db.from('orders').select('id').eq('checkout_request_id', session.checkout_request_id).limit(1)
    // Fail closed: any existing order, including pending-payment orders, blocks abandonment and recovery contact.
    if (orderLookupError || orders?.length) continue
    const { data: updated, error: updateError } = await db.from('checkout_sessions').update({ status: 'ABANDONED', updated_at: now }).eq('id', session.id).in('status', ['STARTED','DETAILS_ENTERED','QUOTED']).lt('last_activity_at', cutoff).select('id').maybeSingle()
    if (updateError || !updated) continue
    marked += 1
    await recordCommerceEvent({ eventId: session.checkout_request_id + ':abandoned', eventName: 'CHECKOUT_ABANDONED', sessionId: session.checkout_request_id, cartId: session.cart_id, metadata: { source: session.source, status: 'ABANDONED' } }).catch(() => undefined)
  }
  const { error: expiredError } = await db.from('checkout_sessions').update({ status: 'ABANDONED', updated_at: now }).lt('expires_at', now).in('status', ['STARTED','DETAILS_ENTERED','QUOTED','ABANDONED'])
  return NextResponse.json({ ok: !expiredError, scanned: rows?.length ?? 0, markedAbandoned: marked })
}
