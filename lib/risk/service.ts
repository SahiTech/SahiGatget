import 'server-only'

import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordCommerceEvent } from '@/lib/analytics/events'

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN'
export type RiskAction = 'ALLOW' | 'ALLOW_WITH_VERIFICATION' | 'MANUAL_REVIEW' | 'REQUIRE_PREPAYMENT' | 'TEMPORARILY_RESTRICT' | 'BLOCK'

export type RiskPolicy = {
  enabled: boolean
  weights: {
    cancelledOneToTwo: number
    cancelledThreePlus: number
    returnedOrders: number
    paymentFailures: number
    rapidAttempts: number
    recentCancellation: number
    successfulDelivery: number
  }
  thresholds: { verification: number; review: number; block: number }
}

export type RiskSignals = {
  totalOrders: number
  cancelledOrders: number
  returnedOrders: number
  paymentFailures: number
  rapidAttempts: number
  recentCancellation: boolean
  successfulDeliveries: number
}

export type RiskAssessment = {
  score: number
  level: RiskLevel
  action: RiskAction
  reasons: string[]
  signals: RiskSignals
  policyVersion: string
}

export const DEFAULT_RISK_POLICY: RiskPolicy = {
  enabled: true,
  weights: { cancelledOneToTwo: 15, cancelledThreePlus: 35, returnedOrders: 25, paymentFailures: 15, rapidAttempts: 20, recentCancellation: 10, successfulDelivery: 15 },
  thresholds: { verification: 25, review: 50, block: 75 },
}

function phoneHash(phone: string) { return createHash('sha256').update(phone.replace(/\D/g, '')).digest('hex') }
function clamp(value: number) { return Math.min(100, Math.max(0, Math.round(value))) }
function isCancelled(status: unknown) { return ['CANCELLED', 'CANCELLED_BY_CUSTOMER', 'FAILED'].includes(String(status).toUpperCase()) }
function isReturned(status: unknown) { return ['RETURN_REQUESTED', 'RETURNED'].includes(String(status).toUpperCase()) }
function isSuccessful(status: unknown) { return ['DELIVERED', 'COMPLETED'].includes(String(status).toUpperCase()) }

export function parseRiskPolicy(value: unknown): RiskPolicy {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const weights = source.weights && typeof source.weights === 'object' ? source.weights as Record<string, unknown> : {}
  const thresholds = source.thresholds && typeof source.thresholds === 'object' ? source.thresholds as Record<string, unknown> : {}
  const numberOr = (candidate: unknown, fallback: number) => Number.isFinite(Number(candidate)) ? Number(candidate) : fallback
  return {
    enabled: source.enabled !== false,
    weights: {
      cancelledOneToTwo: numberOr(weights.cancelledOneToTwo, DEFAULT_RISK_POLICY.weights.cancelledOneToTwo), cancelledThreePlus: numberOr(weights.cancelledThreePlus, DEFAULT_RISK_POLICY.weights.cancelledThreePlus), returnedOrders: numberOr(weights.returnedOrders, DEFAULT_RISK_POLICY.weights.returnedOrders), paymentFailures: numberOr(weights.paymentFailures, DEFAULT_RISK_POLICY.weights.paymentFailures), rapidAttempts: numberOr(weights.rapidAttempts, DEFAULT_RISK_POLICY.weights.rapidAttempts), recentCancellation: numberOr(weights.recentCancellation, DEFAULT_RISK_POLICY.weights.recentCancellation), successfulDelivery: numberOr(weights.successfulDelivery, DEFAULT_RISK_POLICY.weights.successfulDelivery),
    },
    thresholds: { verification: numberOr(thresholds.verification, DEFAULT_RISK_POLICY.thresholds.verification), review: numberOr(thresholds.review, DEFAULT_RISK_POLICY.thresholds.review), block: numberOr(thresholds.block, DEFAULT_RISK_POLICY.thresholds.block) },
  }
}

function policyVersion(policy: RiskPolicy) { return createHash('sha256').update(JSON.stringify(policy)).digest('hex').slice(0, 12) }

function mapPolicy(score: number, policy: RiskPolicy) {
  if (score >= policy.thresholds.block) return { level: 'CRITICAL' as RiskLevel, action: 'BLOCK' as RiskAction }
  if (score >= policy.thresholds.review) return { level: 'HIGH' as RiskLevel, action: 'MANUAL_REVIEW' as RiskAction }
  if (score >= policy.thresholds.verification) return { level: 'MEDIUM' as RiskLevel, action: 'ALLOW_WITH_VERIFICATION' as RiskAction }
  return { level: score > 0 ? 'LOW' as RiskLevel : 'UNKNOWN' as RiskLevel, action: 'ALLOW' as RiskAction }
}

export function scoreCustomerRisk(signals: RiskSignals, policy: RiskPolicy = DEFAULT_RISK_POLICY) {
  if (!policy.enabled) return { score: 0, level: 'UNKNOWN' as RiskLevel, action: 'ALLOW' as RiskAction, reasons: ['Risk controls are disabled by an authorized administrator.'] }
  let score = 0
  const reasons: string[] = []
  if (signals.cancelledOrders >= 3) { score += policy.weights.cancelledThreePlus; reasons.push('Repeated cancelled or failed orders are present.') }
  else if (signals.cancelledOrders >= 1) { score += policy.weights.cancelledOneToTwo; reasons.push('A previous cancelled or failed order is present.') }
  if (signals.returnedOrders > 0) { score += policy.weights.returnedOrders; reasons.push('A previous return or return request is present.') }
  if (signals.paymentFailures > 0) { score += policy.weights.paymentFailures; reasons.push('A previous payment failure signal is present.') }
  if (signals.rapidAttempts > 0) { score += policy.weights.rapidAttempts; reasons.push('Multiple order attempts occurred within a short period.') }
  if (signals.recentCancellation) { score += policy.weights.recentCancellation; reasons.push('A cancellation or failure occurred recently.') }
  if (signals.successfulDeliveries > 0) { score -= policy.weights.successfulDelivery; reasons.push('Successful delivery history reduces risk.') }
  const normalizedScore = clamp(score)
  return { score: normalizedScore, ...mapPolicy(normalizedScore, policy), reasons: reasons.length ? reasons : ['No elevated risk signal was found.'] }
}

const emptySignals: RiskSignals = { totalOrders: 0, cancelledOrders: 0, returnedOrders: 0, paymentFailures: 0, rapidAttempts: 0, recentCancellation: false, successfulDeliveries: 0 }

export async function assessCustomerRisk(input: { phone: string; orderId?: string }): Promise<RiskAssessment> {
  const normalized = input.phone.replace(/\D/g, '')
  if (!/^8801[3-9]\d{8}$/.test(normalized) && !/^01[3-9]\d{8}$/.test(normalized)) return { score: 0, level: 'UNKNOWN', action: 'ALLOW_WITH_VERIFICATION', reasons: ['The mobile number needs a quick verification.'], signals: emptySignals, policyVersion: 'invalid-phone' }
  const db = createAdminClient()
  const { data: policyRow } = await db.from('settings').select('value').eq('key', 'risk_policy').maybeSingle()
  const policy = parseRiskPolicy(policyRow?.value)
  const version = policyVersion(policy)
  const { data: orders, error } = await db.from('orders').select('id,order_status,payment_status,created_at').eq('customer_phone_snapshot', normalized).order('created_at', { ascending: false }).limit(100)
  if (error) return { score: 0, level: 'UNKNOWN', action: 'ALLOW_WITH_VERIFICATION', reasons: ['Order history is temporarily unavailable; a quick verification is recommended.'], signals: emptySignals, policyVersion: version }
  const rows = (orders ?? []) as Array<{ id?: string; order_status?: string; payment_status?: string; created_at?: string }>
  const orderIds = rows.map((row) => row.id).filter((id): id is string => Boolean(id))
  const { data: events } = orderIds.length ? await db.from('commerce_events').select('event_name,order_id').in('order_id', orderIds).in('event_name', ['PAYMENT_FAILED', 'RETURN_REQUESTED']).limit(200) : { data: [] }
  const eventRows = (events ?? []) as Array<{ event_name?: string; order_id?: string }>
  const now = Date.now()
  const cancelledOrders = rows.filter((row) => isCancelled(row.order_status)).length
  const returnedOrders = new Set([...rows.filter((row) => isReturned(row.order_status)).map((row) => row.id), ...eventRows.filter((row) => row.event_name === 'RETURN_REQUESTED').map((row) => row.order_id)]).size
  const successfulDeliveries = rows.filter((row) => isSuccessful(row.order_status)).length
  const paymentFailures = rows.filter((row) => ['FAILED', 'CANCELLED', 'REFUNDED'].includes(String(row.payment_status).toUpperCase())).length + new Set(eventRows.filter((row) => row.event_name === 'PAYMENT_FAILED').map((row) => row.order_id)).size
  const recentCancellation = rows.some((row) => isCancelled(row.order_status) && row.created_at && now - new Date(row.created_at).getTime() <= 30 * 24 * 60 * 60 * 1000)
  const rapidAttempts = rows.filter((row) => row.created_at && now - new Date(row.created_at).getTime() <= 24 * 60 * 60 * 1000).length >= 3 ? 1 : 0
  const signals: RiskSignals = { totalOrders: rows.length, cancelledOrders, returnedOrders, paymentFailures, rapidAttempts, recentCancellation, successfulDeliveries }
  const scored = scoreCustomerRisk(signals, policy)
  const result: RiskAssessment = { ...scored, signals, policyVersion: version }
  const assessment = await db.from('risk_assessments').insert({ order_id: input.orderId ?? null, phone_hash: phoneHash(normalized), score: result.score, level: result.level, action: result.action, reasons: result.reasons }).select('id').maybeSingle()
  if (!assessment.error) await recordCommerceEvent({ eventId: `risk:${input.orderId ?? phoneHash(normalized)}:${version}`, eventName: 'RISK_ASSESSED', orderId: input.orderId ?? null, metadata: { source: 'RISK_ENGINE', score_band: result.level, action: result.action, policy_version: version, total_orders: signals.totalOrders, cancelled_orders: signals.cancelledOrders, returned_orders: signals.returnedOrders, payment_failures: signals.paymentFailures, rapid_attempts: signals.rapidAttempts, successful_deliveries: signals.successfulDeliveries } })
  return result
}

export async function overrideRiskAssessment(input: { assessmentId: string; action: RiskAction; note?: string; actorUserId: string }) {
  const db = createAdminClient()
  const { error } = await db.from('risk_assessments').update({ override_action: input.action, overridden_by: input.actorUserId, internal_note: input.note?.trim().slice(0, 500) || null, updated_at: new Date().toISOString() }).eq('id', input.assessmentId)
  if (error) return { ok: false, message: 'Unable to save the risk override.' }
  return { ok: true }
}
