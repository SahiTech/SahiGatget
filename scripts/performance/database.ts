export async function collectDatabaseMetrics() {
  return {
    status: 'NOT MEASURED',
    reason: 'Supabase runtime query statistics are not available to this CLI without database observability credentials.',
  }
}
