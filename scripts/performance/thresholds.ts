import { performanceBudget } from '../../performance.config'

export function thresholdStatus(metric: string, value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'NOT MEASURED'
  const limits: Record<string, { warning: number; critical: number }> = {
    ttfbMs: { warning: performanceBudget.ttfbWarningMs, critical: performanceBudget.ttfbCriticalMs },
    lcpMs: { warning: performanceBudget.lcpTargetMs, critical: performanceBudget.lcpCriticalMs },
    apiBytes: { warning: performanceBudget.apiWarningBytes, critical: performanceBudget.apiCriticalBytes },
    jsBytes: { warning: performanceBudget.jsWarningBytes, critical: performanceBudget.jsWarningBytes * 2 },
  }
  const limit = limits[metric]
  if (!limit) return 'INFO'
  if (value >= limit.critical) return 'CRITICAL'
  if (value >= limit.warning) return 'WARNING'
  return 'PASS'
}
