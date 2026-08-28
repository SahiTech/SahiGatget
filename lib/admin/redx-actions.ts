'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from './auth'
import { writeAdminAuditLog } from './audit'
import { encryptSecret } from '@/lib/delivery/secrets'
import { REDX_BASE_URL, listRedxAreas, listRedxPickupStores, testRedxConnection } from '@/lib/delivery/redx'

function getProductionOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) return `https://${vercel}`
  return 'https://sahi-gatget.vercel.app'
}

export async function getRedxConfigurationStatusAction() {
  await requireAdmin(['OWNER', 'ADMIN'])
  const db = createAdminClient()
  const [{ data: credentials }, { data: provider }] = await Promise.all([
    db.from('delivery_provider_credentials').select('base_url,encrypted_api_key,encrypted_webhook_token').eq('provider', 'REDX').maybeSingle(),
    db.from('delivery_providers').select('metadata,connection_state,is_enabled').eq('provider', 'REDX').maybeSingle(),
  ])
  const callbackUrl = `${getProductionOrigin()}/api/webhooks/redx`
  return {
    configured: Boolean(credentials?.encrypted_api_key),
    webhookConfigured: Boolean(credentials?.encrypted_webhook_token),
    baseUrl: credentials?.base_url || REDX_BASE_URL,
    callbackUrl,
    connectionState: provider?.connection_state ?? 'NOT_CONNECTED',
    isEnabled: Boolean(provider?.is_enabled),
    pickupStoreId: Number(provider?.metadata?.pickup_store_id ?? 0) || null,
    lastTestAt: provider?.metadata?.last_connection_test_at ?? null,
    lastTest: provider?.metadata?.last_connection_test ?? null,
  }
}

export async function saveRedxConfigurationAction(input: { apiToken?: string; webhookToken?: string; pickupStoreId?: number | null }) {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  const apiToken = input.apiToken?.trim() || ''
  const webhookToken = input.webhookToken?.trim() || ''
  const pickupStoreId = input.pickupStoreId && Number.isInteger(input.pickupStoreId) && input.pickupStoreId > 0 ? input.pickupStoreId : null
  const db = createAdminClient()
  const { data: existing, error: readError } = await db.from('delivery_provider_credentials').select('encrypted_api_key,encrypted_webhook_token').eq('provider', 'REDX').maybeSingle()
  if (readError) return { ok: false, message: 'REDX configuration could not be read.' }
  if (!apiToken && !existing?.encrypted_api_key) return { ok: false, message: 'Enter the REDX Production API Token.' }

  let encryptedApiKey = existing?.encrypted_api_key
  let encryptedWebhookToken = existing?.encrypted_webhook_token
  try {
    if (apiToken) encryptedApiKey = encryptSecret(apiToken.replace(/^Bearer\s+/i, '').trim())
    if (webhookToken) encryptedWebhookToken = encryptSecret(webhookToken)
  } catch {
    return { ok: false, message: 'Server-side credential encryption is not configured.' }
  }

  const now = new Date().toISOString()
  const { error } = await db.from('delivery_provider_credentials').upsert({ provider: 'REDX', environment: 'PRODUCTION', base_url: REDX_BASE_URL, encrypted_api_key: encryptedApiKey, encrypted_webhook_token: encryptedWebhookToken, last_error: null, updated_at: now }, { onConflict: 'provider' })
  if (error) return { ok: false, message: 'REDX configuration could not be saved.' }

  const { error: providerError } = await db.from('delivery_providers').update({
    connection_state: 'NOT_CONNECTED',
    is_enabled: false,
    capabilities: { CREATE_SHIPMENT: 'UNVERIFIED', TRACK_SHIPMENT: 'UNVERIFIED', WEBHOOK: encryptedWebhookToken ? 'SUPPORTED' : 'UNVERIFIED' },
    metadata: { environment: 'PRODUCTION', configuration_source: 'ADMIN', configuration_status: 'CONFIGURED', configuration_updated_at: now, pickup_store_id: pickupStoreId },
    updated_at: now,
  }).eq('provider', 'REDX')
  if (providerError) return { ok: false, message: 'REDX credentials were saved but provider readiness could not be reset. Test the connection before use.' }

  await writeAdminAuditLog({ actorUserId: session.userId, action: 'REDX_CONFIG_UPDATED', entityType: 'delivery_provider', entityId: null, details: { provider: 'REDX', environment: 'PRODUCTION', api_token_configured: true, webhook_token_configured: Boolean(encryptedWebhookToken), pickup_store_id: pickupStoreId } })
  revalidatePath('/admin/delivery')
  return { ok: true, message: 'REDX Production configuration saved. Run the read-only connection test before creating parcels.' }
}

export async function testRedxConnectionAction() {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  try {
    const result = await testRedxConnection()
    const now = new Date().toISOString()
    const db = createAdminClient()
    const configured = await getRedxConfigurationStatusAction()
    const savedStoreId = configured.pickupStoreId && result.stores.some((store: any) => Number(store.id) === Number(configured.pickupStoreId)) ? configured.pickupStoreId : (result.stores[0]?.id ? Number(result.stores[0].id) : null)
    const passed = result.ok && Boolean(savedStoreId)
    await db.from('delivery_providers').update({
      connection_state: passed ? 'CONNECTED' : 'DEGRADED',
      is_enabled: passed,
      capabilities: { CREATE_SHIPMENT: passed ? 'SUPPORTED' : 'UNVERIFIED', TRACK_SHIPMENT: passed ? 'SUPPORTED' : 'UNVERIFIED', WEBHOOK: configured.webhookConfigured ? 'SUPPORTED' : 'UNVERIFIED' },
      metadata: { environment: 'PRODUCTION', last_connection_test_at: now, last_connection_test: passed ? 'PASS' : 'FAIL', pickup_store_id: savedStoreId, pickup_store_count: result.stores.length, area_count: result.areas.length },
      updated_at: now,
    }).eq('provider', 'REDX')
    await writeAdminAuditLog({ actorUserId: session.userId, action: passed ? 'REDX_CONNECTION_TESTED' : 'REDX_CONNECTION_FAILED', entityType: 'delivery_provider', entityId: null, details: { provider: 'REDX', passed, pickup_store_count: result.stores.length, area_count: result.areas.length, pickup_store_id: savedStoreId } })
    revalidatePath('/admin/delivery')
    return { ...result, passed, checkedAt: now, selectedPickupStoreId: savedStoreId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'REDX connection failed.'
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'REDX_CONNECTION_FAILED', entityType: 'delivery_provider', entityId: null, details: { provider: 'REDX', passed: false, message } })
    return { ok: false, passed: false, message, stores: [], areas: [], checkedAt: new Date().toISOString(), selectedPickupStoreId: null }
  }
}

export async function getRedxAreasAction(input: { postCode?: string; districtName?: string }) {
  await requireAdmin()
  return listRedxAreas(input.postCode, input.districtName)
}

export async function getRedxPickupStoresAction() {
  await requireAdmin()
  return listRedxPickupStores()
}
