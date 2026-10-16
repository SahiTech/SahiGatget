export async function collectLighthouseMetrics() {
  return {
    status: 'NOT MEASURED',
    reason: 'No Lighthouse/Chrome runner is installed in the repository. The audit does not add a heavyweight browser dependency.',
  }
}
