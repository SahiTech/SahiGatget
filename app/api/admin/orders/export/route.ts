import { gzipSync } from 'node:zlib'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/orders/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ExportOrder = {
  id: string
  order_number: string
  customer_id: string | null
  customer_name_snapshot: string | null
  customer_phone_snapshot: string | null
  customer_email_snapshot: string | null
  shipping_address: string | null
  shipping_area: string | null
  shipping_district: string | null
  shipping_division: string | null
  shipping_postal_code: string | null
  grand_total: number | string | null
  order_status: string
  payment_status: string
  payment_method: string | null
  created_at: string
}

type CustomerExportRow = {
  phone: string
  email: string
  first: string
  last: string
  city: string
  state: string
  zip: string
  external: string
  value: number
  orderCount: number
  lastOrderAt: string
}

function cell(value: unknown) {
  const s = value == null ? '' : String(value)
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
function row(values: unknown[]) { return values.map(cell).join(',') }
function nameParts(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean)
  return [p[0] ?? '', p.slice(1).join(' ')]
}
async function loadOrders(days: number) {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  const db = createAdminClient()
  const all: ExportOrder[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('orders')
      .select('id,order_number,customer_id,customer_name_snapshot,customer_phone_snapshot,customer_email_snapshot,shipping_address,shipping_area,shipping_district,shipping_division,shipping_postal_code,grand_total,order_status,payment_status,payment_method,created_at')
      .gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
      .order('created_at', { ascending: true }).range(from, from + 999)
    if (error) throw new Error('EXPORT_QUERY_FAILED')
    all.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return all
}
export async function GET(request: NextRequest) {
  await requireAdmin()
  const requested = Number(request.nextUrl.searchParams.get('days') ?? '365')
  const days = [30, 90, 180, 365].includes(requested) ? requested : 365
  const format = request.nextUrl.searchParams.get('format') === 'orders' ? 'orders' : 'customers'
  const orders = await loadOrders(days)
  const lines: string[] = []
  if (format === 'orders') {
    lines.push(row(['order_id','order_number','customer_id','customer_name','phone','email','address','area','district','division','postal_code','order_total','order_status','payment_status','payment_method','order_date']))
    for (const o of orders) lines.push(row([o.id,o.order_number,o.customer_id,o.customer_name_snapshot,normalizePhone(o.customer_phone_snapshot ?? ''),o.customer_email_snapshot?.trim().toLowerCase() ?? '',o.shipping_address,o.shipping_area,o.shipping_district,o.shipping_division,o.shipping_postal_code,o.grand_total,o.order_status,o.payment_status,o.payment_method,o.created_at]))
  } else {
    lines.push(row(['phone','email','first_name','last_name','city','state','zip','country','external_id','value','currency','orders','last_order_at']))
    const map = new Map<string, CustomerExportRow>()
    for (const o of orders) {
      const phone = normalizePhone(o.customer_phone_snapshot ?? '')
      const email = o.customer_email_snapshot?.trim().toLowerCase() ?? ''
      const key = phone || email || o.customer_id || o.id
      const parts = nameParts(o.customer_name_snapshot ?? '')
      const current = map.get(key)
      if (!current) {
        const customer = {
          phone,
          email,
          first: parts[0],
          last: parts[1],
          city: o.shipping_district ?? o.shipping_area ?? '',
          state: o.shipping_division ?? '',
          zip: o.shipping_postal_code ?? '',
          external: o.customer_id ?? o.id,
          value: Number(o.grand_total ?? 0),
          orderCount: 1,
          lastOrderAt: o.created_at,
        }
        map.set(key, customer)
      } else {
        current.value += Number(o.grand_total ?? 0)
        current.orderCount += 1
        if (new Date(o.created_at) > new Date(current.lastOrderAt)) current.lastOrderAt = o.created_at
      }
    }
    for (const c of map.values()) lines.push(row([c.phone,c.email,c.first,c.last,c.city,c.state,c.zip,'BD',c.external,c.value,'BDT',c.orderCount,c.lastOrderAt]))
  }
  const body = gzipSync(Buffer.from('\uFEFF' + lines.join('\n') + '\n','utf8'),{level:9})
  const suffix = format === 'orders' ? 'orders' : 'customers-facebook-ready'
  const filename = `sahigadget-${suffix}-${days}d-${new Date().toISOString().slice(0,10)}.csv.gz`
  return new Response(body,{headers:{'Content-Type':'application/gzip','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'private, no-store'}})
}