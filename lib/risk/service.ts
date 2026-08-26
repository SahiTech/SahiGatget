import 'server-only'

import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN'
export type RiskAction = 'ALLOW' | 'ALLOW_WITH_VERIFICATION' | 'MANUAL_REVIEW' | 'REQUIRE_PREPAYMENT' | 'TEMPORARILY_RESTRICT' | 'BLOCK'
export type RiskAssessment = { score: number; level: RiskLevel; action: RiskAction; reasons: string[] }

function phoneHash(phone: string) { return createHash('sha256').update(phone.replace(/\D/g, '')).digest('hex') }

export async function assessCustomerRisk(input: { phone: string; orderId?: string }): Promise<RiskAssessment> {
  const normalized = input.phone.replace(/\D/g, '')
  if (!/^8801[3-9]\d{8}$/.test(normalized) && !/^01[3-9]\d{8}$/.test(normalized)) return { score: 0, level: 'UNKNOWN', action: 'ALLOW_WITH_VERIFICATION', reasons: ['Phone format requires verification.'] }
  const db = createAdminClient()
  const { data: orders, error } = await db.from('orders').select('order_status,payment_status,created_at').eq('customer_phone_snapshot', input.phone).order('created_at', { ascending: false }).limit(50)
  if (error) return { score: 0, level: 'UNKNOWN', action: 'ALLOW_WITH_VERIFICATION', reasons: ['History unavailable; manual verification is recommended.'] }
  const rows = (orders ?? []) as Array<{ order_status?: string; payment_status?: string; created_at?: string }>
  const cancelled = rows.filter((row) => ['CANCELLED', 'CANCELLED_BY_CUSTOMER', 'FAILED'].includes(String(row.order_status))).length
  const delivered = rows.filter((row) => ['DELIVERED', 'COMPLETED'].includes(String(row.order_status))).length
  const repeated = rows.length > 2 && new Set(rows.slice(0, 3).map((row) => row.created_at?.slice(0, 10))).size === 1
  let score = 0
  const reasons: string[] = []
  if (cancelled >= 3) { score += 45; reasons.push('Repeated cancelled or failed orders.') }
  else if (cancelled >= 1) { score += 15; reasons.push('A previous cancelled or failed order exists.') }
  if (delivered >= 1) { score = Math.max(0, score - 15); reasons.push('Successful delivery history is present.') }
  if (repeated) { score += 25; reasons.push('Multiple rapid order attempts were detected.') }
  const level: RiskLevel = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : rows.length ? 'LOW' : 'UNKNOWN'
  const action: RiskAction = level === 'CRITICAL' ? 'MANUAL_REVIEW' : level === 'HIGH' ? 'ALLOW_WITH_VERIFICATION' : 'ALLOW'
  const result = { score, level, action, reasons: reasons.length ? reasons : ['No elevated risk signal was found.'] }
  await db.from('risk_assessments').insert({ order_id: input.orderId ?? null, phone_hash: phoneHash(input.phone), score, level, action, reasons: result.reasons })
  return result
}

export async function overrideRiskAssessment(input: { assessmentId: string; action: RiskAction; note?: string; actorUserId: string }) {
  const db = createAdminClient()
  const { error } = await db.from('risk_assessments').update({ override_action: input.action, overridden_by: input.actorUserId, internal_note: input.note?.trim().slice(0, 500) || null, updated_at: new Date().toISOString() }).eq('id', input.assessmentId)
  if (error) return { ok: false, message: 'Unable to save the risk override.' }
  return { ok: true }
}
