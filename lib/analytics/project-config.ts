export type AnalyticsProjectConfig = {
  projectKey: string
  currency: string
}

export const DEFAULT_ANALYTICS_PROJECT_CONFIG: AnalyticsProjectConfig = {
  projectKey: 'commerce',
  currency: 'USD',
}

const PROJECT_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/
const CURRENCY_PATTERN = /^[A-Z]{3}$/

export function normalizeAnalyticsProjectKey(value: string | null | undefined) {
  const normalized = (value || '').trim().toLowerCase()
  return PROJECT_KEY_PATTERN.test(normalized) ? normalized : DEFAULT_ANALYTICS_PROJECT_CONFIG.projectKey
}

export function normalizeAnalyticsCurrency(value: string | null | undefined) {
  const normalized = (value || '').trim().toUpperCase()
  return CURRENCY_PATTERN.test(normalized) ? normalized : DEFAULT_ANALYTICS_PROJECT_CONFIG.currency
}

export function analyticsEventSchema(projectKey: string) {
  return `${normalizeAnalyticsProjectKey(projectKey)}.analytics.event`
}
