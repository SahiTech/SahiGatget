import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/cart'
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(new URL(`/customer/login?next=${encodeURIComponent(next)}&error=oauth`, request.url))
  }

  const client = await createClient()
  const { error } = await client.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL(`/customer/login?next=${encodeURIComponent(next)}&error=oauth`, request.url))
  }

  return NextResponse.redirect(new URL(next, request.url))
}
