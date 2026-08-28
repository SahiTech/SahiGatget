'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from './auth'
import { writeAdminAuditLog } from './audit'
import { encryptSecret } from '@/lib/delivery/secrets'
import { STEADFAST_BASE_URL, testSteadfastConnection } from '@/lib/delivery/steadfast'

export async function getSteadfastConfigurationStatusAction() {
  await requireAdmin(['OWNER', 'ADMIN'])
  const db = createAdminClient()
  const { data } = await db.from('delivery_provider_credentials').select('base_url,encrypted_api_key,encrypted_secret_key,encrypted_webhook_token').eq('provider', 'STEADFAST').maybeSingle()
  return { configured: Boolean(data?.encrypted_api_key && data?.encrypted_secret_key), webhookConfigured: Boolean(data?.encrypted_webhook_token), baseUrl: data?.base_url || STEADFAST_BASE_URL }
}

export async function saveSteadfastConfigurationAction(input: { apiKey?: string; secretKey?: string; webhookToken?: string }) {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  const apiKey = input.apiKey?.trim() || ''
  const secretKey = input.secretKey?.trim() || ''
  const webhookToken = input.webhookToken?.trim() || ''
  const db = createAdminClient()
  const { data: existing, error: readError } = await db.from('delivery_provider_credentials').select('encrypted_api_key,encrypted_secret_key,encrypted_webhook_token').eq('provider', 'STEADFAST').maybeSingle()
  if (readError) return { ok: false, message: 'Steadfast configuration could not be read.' }
  if (!apiKey && !existing?.encrypted_api_key) return { ok: false, message: 'Enter the Steadfast API Key.' }
  if (!secretKey && !existing?.encrypted_secret_key) return { ok: false, message: 'Enter the Steadfast Secret Key.' }
  let encryptedApiKey = existing?.encrypted_api_key
  let encryptedSecretKey = existing?.encrypted_secret_key
  let encryptedWebhookToken = existing?.encrypted_webhook_token
  try {
    if (apiKey) encryptedApiKey = encryptSecret(apiKey)
    if (secretKey) encryptedSecretKey = encryptSecret(secretKey)
    if (webhookToken) encryptedWebhookToken = encryptSecret(webhookToken)
  } catch { return { ok: false, message: 'Server-side credential encryption is not configured.' } }
  const now = new Date().toISOString()
  const { error } = await db.from('delivery_provider_credentials').upsert({ provider: 'STEADFAST', environment: 'PRODUCTION', base_url: STEADFAST_BASE_URL, encrypted_api_key: encryptedApiKey, encrypted_secret_key: encryptedSecretKey, encrypted_webhook_token: encryptedWebhookToken, last_error: null, updated_at: now }, { onConflict: 'provider' })
  if (error) return { ok: false, message: 'Steadfast configuration could not be saved.' }
  await db.from('delivery_providers').update({ connection_state: 'NOT_CONNECTED', is_enabled: false, capabilities: { CREATE_SHIPMENT: 'UNVERIFIED', TRACK_SHIPMENT: 'UNVERIFIED', WEBHOOK: webhookToken || existing?.encrypted_webhook_token ? 'SUPPORTED' : 'UNVERIFIED', GET_BALANCE: 'UNVERIFIED' }, metadata: { environment: 'PRODUCTION', configuration_source: 'ADMIN', configuration_status: 'CONFIGURED', configuration_updated_at: now }, updated_at: now }).eq('provider', 'STEADFAST')
  await writeAdminAuditLog({ actorUserId: session.userId, action: 'STEADFAST_CONFIG_UPDATED', entityType: 'delivery_provider', entityId: null, details: { provider: 'STEADFAST', environment: 'PRODUCTION', api_key_configured: true, secret_key_configured: true, webhook_token_configured: Boolean(webhookToken || existing?.encrypted_webhook_token) } })
  revalidatePath('/admin/delivery')
  return { ok: true, message: 'Steadfast configuration saved. Run the connection test before enabling shipments.' }
}

export async function testSteadfastConnectionAction() {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  const result = await testSteadfastConnection()
  const now = new Date().toISOString()
  const db = createAdminClient()
  await db.from('delivery_providers').update({ connection_state: result.ok ? 'CONNECTED' : 'DEGRADED', is_enabled: result.ok, capabilities: { CREATE_SHIPMENT: result.ok ? 'SUPPORTED' : 'UNVERIFIED', TRACK_SHIPMENT: result.ok ? 'SUPPORTED' : 'UNVERIFIED', WEBHOOK: 'UNVERIFIED', GET_BALANCE: result.ok ? 'SUPPORTED' : 'UNVERIFIED' }, metadata: { environment: 'PRODUCTION', last_connection_test_at: now, last_connection_test: result.ok ? 'PASS' : 'FAIL', balance_available: result.balance != null }, updated_at: now }).eq('provider', 'STEADFAST')
  await writeAdminAuditLog({ actorUserId: session.userId, action: result.ok ? 'STEADFAST_CONNECTION_TESTED' : 'STEADFAST_CONNECTION_FAILED', entityType: 'delivery_provider', entityId: null, details: { provider: 'STEADFAST', passed: result.ok, balance_available: result.balance != null } })
  revalidatePath('/admin/delivery')
  return result
}
