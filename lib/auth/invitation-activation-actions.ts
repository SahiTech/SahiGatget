'use server'

import { getAdminSession } from '@/lib/admin/auth'
import { createClient } from '@/lib/supabase/server'

export type InvitationActivationAuthorization =
  | { ok: true }
  | { ok: false; message: string }

export async function authorizeActivatedOwner(): Promise<InvitationActivationAuthorization> {
  const adminSession = await getAdminSession()

  if (adminSession?.role === 'OWNER') {
    return { ok: true }
  }

  const client = await createClient()
  await client.auth.signOut()

  return {
    ok: false,
    message: 'This account is not approved for SahiGadget owner access. Contact the account owner if you believe this is incorrect.',
  }
}
