export type QueryMetric = { name: string; latencyMs?: number; operations?: number; status: 'PASS' | 'WARNING' | 'NOT MEASURED'; evidence?: string }

export function summarizeQueries(metrics: QueryMetric[]) {
  return metrics.map((metric) => ({ ...metric, latencyMs: metric.latencyMs ?? null, operations: metric.operations ?? null }))
}
