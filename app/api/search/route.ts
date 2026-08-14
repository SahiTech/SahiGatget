import { NextResponse } from 'next/server'
import { getProducts } from '@/lib/services/storefront'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() || ''
  if (!q) return NextResponse.json({ products: [] })
  try {
    const result = await getProducts({ query: q, pageSize: 6 })
    return NextResponse.json({ products: result.products })
  } catch (e) {
    return NextResponse.json({ products: [] }, { status: 500 })
  }
}
