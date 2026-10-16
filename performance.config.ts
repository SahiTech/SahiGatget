export const performanceBudget = {
  ttfbWarningMs: 800,
  ttfbCriticalMs: 1500,
  lcpTargetMs: 2500,
  lcpCriticalMs: 4000,
  inpTargetMs: 200,
  clsTarget: 0.1,
  apiWarningBytes: 200_000,
  apiCriticalBytes: 500_000,
  slowQueryWarningMs: 300,
  slowQueryCriticalMs: 1000,
  jsWarningBytes: 250_000,
} as const
