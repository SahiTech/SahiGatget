'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const CUSTOMER_PROVIDERS = new Set(['google', 'facebook'])

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : '/cart'
  return next.startsWith('/') && !next.startsWith('//') ? next : '/cart'
}

export async function signInCustomer(formData: FormData) {
  const provider = formData.get('provider')
  if (typeof provider !== 'string' || !CUSTOMER_PROVIDERS.has(provider)) {
    throw new Error('Unsupported customer sign-in provider')
  }

  const next = safeNext(formData.get('next'))
  const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.sahigadget.shop'
  const callbackUrl = new URL('/auth/customer/callback', origin)
  callbackUrl.searchParams.set('next', next)

  const client = await createClient()
  const { data, error } = await client.auth.signInWithOAuth({
    provider: provider as 'google' | 'facebook',
    options: {
      redirectTo: callbackUrl.toString(),
      queryParams: provider === 'google' ? { access_type: 'offline', prompt: 'select_account' } : undefined,
    },
  })

  if (error || !data.url) {
    redirect(`/customer/login?next=${encodeURIComponent(next)}&error=oauth`)
  }

  redirect(data.url)
}
