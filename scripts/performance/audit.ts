import { performance } from 'node:perf_hooks'
import { performanceBudget } from '../../performance.config'
import { collectBundleMetrics } from './bundle'
import { collectDatabaseMetrics } from './database'
import { collectImageHints } from './images'
import { collectLighthouseMetrics } from './lighthouse'
import { publicRoutes } from './routes'
import { writeReports } from './report'
import { thresholdStatus } from './thresholds'

const baseUrl = (process.env.PERFORMANCE_BASE_URL || '').replace(/\/$/, '')

async function measureRoute(route: string) {
  if (!baseUrl) return { route, status: 'NOT MEASURED', reason: 'Set PERFORMANCE_BASE_URL to a deployed storefront URL.' }
  const start = performance.now()
  try {
    const response = await fetch(baseUrl + route, { redirect: 'follow' })
    const body = await response.arrayBuffer()
    const ttfbMs = Math.round((performance.now() - start) * 100) / 100
    return { route, status: response.ok ? thresholdStatus('ttfbMs', ttfbMs) : 'WARNING', httpStatus: response.status, ttfbMs, bytes: body.byteLength }
  } catch (error) {
    return { route, status: 'NOT MEASURED', reason: error instanceof Error ? error.message : 'Request failed' }
  }
}

async function main() {
  const routes = await Promise.all(publicRoutes.map(measureRoute))
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: baseUrl || null,
    budgets: performanceBudget,
    routes,
    bundle: await collectBundleMetrics(),
    images: await collectImageHints(),
    database: await collectDatabaseMetrics(),
    lighthouse: await collectLighthouseMetrics(),
  }
  await writeReports(report)
  console.log(JSON.stringify(report, null, 2))
  const critical = routes.some((route) => route.status === 'CRITICAL')
  if (critical) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
