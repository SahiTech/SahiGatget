import 'server-only'

import { requireAdmin } from './auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAssistantControlConfig, loadAssistantPolicyConfig, getAssistantConfigurationStatus } from '@/lib/assistant/config'

const ASSISTANT_ACTIONS = ['ASSISTANT_REQUEST', 'ASSISTANT_UNANSWERED', 'ASSISTANT_ERROR', 'ASSISTANT_RATE_LIMITED']
const HEALTH_ACTIONS = [...ASSISTANT_ACTIONS, 'AI_CONNECTION_TESTED', 'AI_CONNECTION_FAILED']

function safeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export type AssistantAnalyticsRange = 'today' | '7d' | '30d'

export async function getAssistantControlCenterData(options: { range?: AssistantAnalyticsRange; page?: number } = {}) {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  const db = createAdminClient()
  const range = options.range ?? '7d'
  const page = Math.max(1, Math.floor(options.page ?? 1))
  const now = Date.now()
  const rangeMs = range === 'today' ? 24 * 60 * 60 * 1000 : range === '30d' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
  const since = new Date(now - rangeMs).toISOString()
  const [config, policy, settingsResult, eventsResult] = await Promise.all([
    loadAssistantControlConfig(),
    loadAssistantPolicyConfig(),
    db.from('settings').select('key, value, description, updated_at').in('key', ['assistant_config', 'assistant_prompts']).limit(2),
    db.from('audit_logs').select('id, action, entity_type, entity_id, details, created_at').in('action', HEALTH_ACTIONS).gte('created_at', since).order('created_at', { ascending: false }).limit(500),
  ])
  if (settingsResult.error) throw new Error('Unable to load assistant settings.')
  if (eventsResult.error) throw new Error('Unable to load assistant analytics.')

  const settings = Object.fromEntries((settingsResult.data ?? []).map((row) => [row.key, row]))
  const events = eventsResult.data ?? []
  const byAction = Object.fromEntries(ASSISTANT_ACTIONS.map((action) => [action, events.filter((event) => event.action === action).length]))
  const intentCounts = new Map<string, number>()
  const unansweredPatterns = new Map<string, number>()
  for (const event of events) {
    const details = event.details && typeof event.details === 'object' ? event.details as Record<string, unknown> : {}
    const intent = typeof details.intent === 'string' ? details.intent : 'unknown'
    intentCounts.set(intent, (intentCounts.get(intent) ?? 0) + 1)
    if (event.action === 'ASSISTANT_UNANSWERED') {
      const pattern = typeof details.pattern === 'string' ? details.pattern : 'unclassified'
      unansweredPatterns.set(pattern, (unansweredPatterns.get(pattern) ?? 0) + 1)
    }
  }
  const requestEvents = events.filter((event) => event.action === 'ASSISTANT_REQUEST')
  const successfulTest = events.find((event) => event.action === 'AI_CONNECTION_TESTED')
  const lastSuccessfulRequest = requestEvents.find((event) => (event.details as Record<string, unknown> | null)?.status === 'answered' || (event.details as Record<string, unknown> | null)?.outcome === 'answered')
  const totalRequests = requestEvents.length
  const pageSize = 25
  const totalPages = Math.max(1, Math.ceil(events.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedEvents = events.slice((safePage - 1) * pageSize, safePage * pageSize)
  const averageLatencyMs = totalRequests ? Math.round(requestEvents.reduce((sum, event) => sum + safeNumber((event.details as Record<string, unknown> | null)?.latencyMs), 0) / totalRequests) : 0

  return {
    session: { role: session.role, fullName: session.fullName },
    config,
    policy,
    configurationStatus: await getAssistantConfigurationStatus(config),
    settings,
    analytics: {
      totalRequests,
      averageLatencyMs,
      answeredRequests: byAction.ASSISTANT_REQUEST - byAction.ASSISTANT_UNANSWERED,
      unansweredRequests: byAction.ASSISTANT_UNANSWERED,
      rateLimitedRequests: byAction.ASSISTANT_RATE_LIMITED,
      errors: byAction.ASSISTANT_ERROR,
      byIntent: Array.from(intentCounts.entries()).sort((a, b) => b[1] - a[1]).map(([intent, count]) => ({ intent, count })),
      unansweredPatterns: Array.from(unansweredPatterns.entries()).sort((a, b) => b[1] - a[1]).map(([pattern, count]) => ({ pattern, count })),
      range,
      page: safePage,
      pageSize,
      totalEvents: events.length,
      totalPages,
      hasPrevious: safePage > 1,
      hasNext: safePage < totalPages,
      recentEvents: pagedEvents.map((event) => ({ id: event.id, action: event.action, createdAt: event.created_at, details: event.details })),
      health: { lastSuccessfulTestAt: successfulTest?.created_at ?? null, lastSuccessfulRequestAt: lastSuccessfulRequest?.created_at ?? null, knowledgeSourcesEnabled: Object.values(config.knowledgeSources).filter(Boolean).length, knowledgeSourcesTotal: Object.keys(config.knowledgeSources).length, rateLimitStatus: Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) ? 'operational' as const : 'not_configured' as const },
    },
  }
}
