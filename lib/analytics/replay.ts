import 'server-only'

import { processAnalyticsDeliveryWorker } from './worker'

export async function replayFailedAnalyticsDeliveries(limit = 20) {
  return processAnalyticsDeliveryWorker(limit)
}
