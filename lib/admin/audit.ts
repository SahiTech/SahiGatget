import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

const blockedKeys = new Set([
  'password',
  'token',
  'secret',
  'service_role_key',
  'authorization',
  'cookie',
  'email',
  'phone',
  'address',
  'imei_1',
  'imei_2',
  'serial_number',
])

function safeMetadata(value: Record<string, unknown> | undefined) {
  if (!value) return null

  return Object.fromEntries(
    Object.entries(value).filter(([key, item]) => {
      if (blockedKeys.has(key.toLowerCase())) return false
      return item === null || ['string', 'number', 'boolean'].includes(typeof item)
    })
  )
}

export async function writeAdminAuditLog(input: {
  actorUserId: string
  action: string
  entityType: string
  entityId?: string | null
  details?: Record<string, unknown>
}) {
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('audit_logs').insert({
    user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    details: safeMetadata(input.details),
  })

  if (error) throw new Error('Unable to record the administrative audit event.')
}
