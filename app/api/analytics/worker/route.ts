import { NextResponse } from 'next/server'
import { getAnalyticsWorkerSecret } from '@/lib/analytics/delivery-ledger'
import { processAnalyticsDeliveryWorker } from '@/lib/analytics/worker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function isAuthorized(request: Request) {
  const authorization = request.headers.get('authorization') || ''
  const configuredSecret = process.env.CRON_SECRET?.trim()

  if (configuredSecret) {
    return authorization === `Bearer ${configuredSecret}`
  }

  const workerSecret = await getAnalyticsWorkerSecret()
  return Boolean(workerSecret && authorization === `Bearer ${workerSecret}`)
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json(
      { ok: false, message: 'Unauthorized.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  try {
    const result = await processAnalyticsDeliveryWorker()
    console.log(JSON.stringify({
      level: 'info',
      msg: 'analytics_delivery_worker',
      claimed: result.claimed,
      attempted: result.attempted,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
      dead: result.dead,
    }))
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      msg: 'analytics_delivery_worker_failed',
      error: error instanceof Error ? error.message : String(error),
    }))
    return NextResponse.json(
      { ok: false, claimed: 0, attempted: 0, succeeded: 0, failed: 0, skipped: 0, dead: 0 },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
