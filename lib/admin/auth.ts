import 'server-only'

import { cache } from 'react'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const ADMIN_ROLES = ['OWNER', 'ADMIN', 'STAFF'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export type AdminSession = {
  id: string
  userId: string
  fullName: string
  email: string
  role: AdminRole
}

const roleRank: Record<AdminRole, number> = {
  STAFF: 1,
  ADMIN: 2,
  OWNER: 3,
}

export function hasMinimumRole(role: AdminRole, minimumRole: AdminRole) {
  return roleRank[role] >= roleRank[minimumRole]
}

export function hasAnyRole(role: AdminRole, allowedRoles: readonly AdminRole[]) {
  return allowedRoles.includes(role)
}

export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const client = await createClient()
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser()

  if (userError || !user) return null

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('admin_users')
    .select('id, user_id, full_name, email, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data || !ADMIN_ROLES.includes(data.role as AdminRole)) return null

  return {
    id: data.id,
    userId: data.user_id,
    fullName: data.full_name,
    email: data.email,
    role: data.role as AdminRole,
  }
})

export async function requireAdmin(allowedRoles: readonly AdminRole[] = ADMIN_ROLES) {
  const session = await getAdminSession()
  if (!session || !hasAnyRole(session.role, allowedRoles)) {
    throw new Error('ADMIN_FORBIDDEN')
  }
  return session
}
