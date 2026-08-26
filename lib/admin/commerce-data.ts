import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export async function getCommerceOperationsSummary() {
  const db = createAdminClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const since = today.toISOString()
  const [carts, checkouts, risks, events, shipments] = await Promise.all([
    db.from('carts').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    db.from('checkout_sessions').select('id,status', { count: 'exact' }).gte('last_activity_at', since).limit(500),
    db.from('risk_assessments').select('id,level,action', { count: 'exact' }).gte('created_at', since).limit(500),
    db.from('commerce_events').select('id,event_name', { count: 'exact' }).gte('occurred_at', since).limit(500),
    db.from('shipments').select('id,status', { count: 'exact' }).in('status', ['IN_TRANSIT', 'OUT_FOR_DELIVERY']).limit(500),
  ])
  const checkoutRows = (checkouts.data ?? []) as Array<{ status?: string }>
  const riskRows = (risks.data ?? []) as Array<{ level?: string }>
  const eventRows = (events.data ?? []) as Array<{ event_name?: string }>
  return {
    activeCarts: carts.count ?? 0,
    checkoutsToday: checkouts.count ?? checkoutRows.length,
    abandonedCheckouts: checkoutRows.filter((row) => row.status === 'ABANDONED').length,
    highRiskToday: riskRows.filter((row) => row.level === 'HIGH' || row.level === 'CRITICAL').length,
    shipmentsInTransit: shipments.count ?? 0,
    completedOrdersToday: eventRows.filter((row) => row.event_name === 'ORDER_COMPLETED').length,
    paymentFailuresToday: eventRows.filter((row) => row.event_name === 'PAYMENT_FAILED').length,
    errors: [carts, checkouts, risks, events, shipments].filter((result) => result.error).map((result) => result.error?.message ?? 'Unknown data error'),
  }
}
