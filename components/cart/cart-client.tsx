'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { trackClientEvent } from '@/lib/analytics/client'
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { clearCartAction, removeCartItemAction, updateCartItemAction } from '@/lib/commerce/actions'
import { formatPrice } from '@/lib/services/storefront-utils'

type CartItem = { id: string; quantity: number; product?: { name: string; slug: string; image_url: string | null }; variant?: { sku: string; variant_title: string; price: number; is_in_stock: boolean } }
function analyticsItem(item: CartItem, quantity = item.quantity) {
  return {
    item_id: item.variant?.sku || item.id,
    item_name: item.product?.name || item.variant?.variant_title || 'Product',
    price: Number(item.variant?.price ?? 0),
    quantity,
  }
}
export function CartClient({ initialCart }: { initialCart: { items: CartItem[]; subtotal: number; itemCount: number } }) {
  const [cart, setCart] = useState(initialCart)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const pendingQuantities = useRef<Map<string, number>>(new Map())
  useEffect(() => {
    trackClientEvent({
      eventName: 'view_cart',
      commerce: {
        currency: 'BDT',
        value: initialCart.subtotal,
        item_count: initialCart.itemCount,
        items: initialCart.items.map((item) => analyticsItem(item)),
      },
    })
  }, [initialCart.items, initialCart.itemCount, initialCart.subtotal])
  async function run(action: () => Promise<{ ok: boolean; message?: string; data?: typeof initialCart }>, eventName?: 'add_to_cart' | 'remove_from_cart') {
    const previous = cart
    setBusy(true); setMessage('')
    const result = await action()
    setBusy(false)
    if (!result.ok) { setMessage(result.message ?? 'Unable to update your cart.'); return }
    if (result.data) {
      setCart(result.data)
      if (eventName) {
        const value = eventName === 'remove_from_cart'
          ? Math.max(previous.subtotal - result.data.subtotal, 0)
          : Math.max(result.data.subtotal - previous.subtotal, 0)
        trackClientEvent({
          eventName,
          commerce: {
            currency: 'BDT',
            value,
            item_count: Math.abs(previous.itemCount - result.data.itemCount),
            items: previous.items.map((item) => analyticsItem(item)),
          },
        })
      }
    }
  }

  async function removeItemFast(item: CartItem) {
    const previous = cart
    setMessage('')
    setCart((current) => {
      const items = current.items.filter((row) => row.id !== item.id)
      return {
        ...current,
        items,
        subtotal: items.reduce((sum, row) => sum + Number(row.variant?.price ?? 0) * row.quantity, 0),
        itemCount: items.reduce((sum, row) => sum + row.quantity, 0),
      }
    })
    const result = await removeCartItemAction(item.id)
    if (!result.ok) {
      setCart(previous)
      setMessage(result.message ?? 'Unable to remove that item.')
      return
    }
    if (result.data) setCart(result.data)
    trackClientEvent({
      eventName: 'remove_from_cart',
      commerce: {
        currency: 'BDT',
        value: Number(item.variant?.price ?? 0) * item.quantity,
        item_count: item.quantity,
        items: [analyticsItem(item)],
      },
    })
  }

  function changeQuantity(item: CartItem, nextQuantity: number) {
    const quantity = Math.max(1, Math.min(10, nextQuantity))
    const previousQuantity = item.quantity
    setMessage('')
    setCart((current) => {
      const items = current.items.map((row) => row.id === item.id ? { ...row, quantity } : row)
      const subtotal = items.reduce((sum, row) => sum + Number(row.variant?.price ?? 0) * row.quantity, 0)
      return { ...current, items, subtotal, itemCount: items.reduce((sum, row) => sum + row.quantity, 0) }
    })
    pendingQuantities.current.set(item.id, quantity)
    const existing = pendingTimers.current.get(item.id)
    if (existing) clearTimeout(existing)
    pendingTimers.current.set(item.id, setTimeout(async () => {
      const target = pendingQuantities.current.get(item.id)
      if (target == null) return
      pendingQuantities.current.delete(item.id)
      pendingTimers.current.delete(item.id)
      setBusy(true)
      const result = await updateCartItemAction({ itemId: item.id, quantity: target })
      setBusy(false)
      if (!result.ok) {
        setCart((current) => {
          const items = current.items.map((row) => row.id === item.id ? { ...row, quantity: previousQuantity } : row)
          const subtotal = items.reduce((sum, row) => sum + Number(row.variant?.price ?? 0) * row.quantity, 0)
          return { ...current, items, subtotal, itemCount: items.reduce((sum, row) => sum + row.quantity, 0) }
        })
        setMessage(result.message ?? 'Unable to update your cart.')
        return
      }
      if (result.data) setCart(result.data)
      const changedQuantity = Math.abs(target - previousQuantity)
      trackClientEvent({
        eventName: target > previousQuantity ? 'add_to_cart' : 'remove_from_cart',
        commerce: {
          currency: 'BDT',
          value: Number(item.variant?.price ?? 0) * changedQuantity,
          item_count: changedQuantity,
          items: [analyticsItem(item, changedQuantity)],
        },
      })
    }, 250))
  }
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Almost yours</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-slate-950">Review your order</h1><p className="mt-2 text-sm text-slate-500">Check your item and quantity, then continue to secure checkout.</p></div>
        <ShoppingBag className="h-6 w-6 shrink-0 text-orange-600" />
      </div>
      {message ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{message}</p> : null}
      {!cart.items.length ? <div className="py-16 text-center"><p className="text-lg font-black text-slate-950">Your cart is empty.</p><Link href="/products" className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white">Browse products</Link></div> :
        <div className="mt-5 space-y-3">{cart.items.map((item) => <div key={item.id} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <Link href={item.product?.slug ? `/products/${item.product.slug}` : '/products'} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-50 sm:h-28 sm:w-28">
            {item.product?.image_url ? <Image src={item.product.image_url} alt={item.product.name ?? 'Product'} fill sizes="112px" className="object-contain p-2" /> : <div className="flex h-full items-center justify-center text-xs font-black text-slate-400">No image</div>}
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={item.product?.slug ? `/products/${item.product.slug}` : '/products'} className="line-clamp-2 font-black text-slate-950 hover:text-orange-700">{item.product?.name ?? 'Product'}</Link>
            <p className="mt-1 text-xs text-slate-500">{item.variant?.variant_title || item.variant?.sku}</p>
            <p className="mt-2 text-lg font-black text-slate-950">{formatPrice(Number(item.variant?.price ?? 0))}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50">
                <button type="button" disabled={item.quantity <= 1} onClick={() => changeQuantity(item, item.quantity - 1)} className="p-2 disabled:opacity-40" aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center text-sm font-black">{item.quantity}</span>
                <button type="button" disabled={item.quantity >= 10} onClick={() => changeQuantity(item, item.quantity + 1)} className="p-2 disabled:opacity-40" aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
              </div>
              <button type="button" disabled={false} onClick={() => removeItemFast(item)} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
            </div>
          </div>
        </div>)}</div>}
      {cart.items.length ? <button type="button" disabled={busy} onClick={() => run(() => clearCartAction(), 'remove_from_cart')} className="mt-5 text-sm font-bold text-slate-400 underline underline-offset-4">Clear cart</button> : null}
    </section>
    <aside className="h-fit rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-xl lg:sticky lg:top-24 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">Ready to order?</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight">Confirm your details next</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">Your delivery location and final order total will be confirmed securely at checkout.</p>
      <div className="mt-5 rounded-xl bg-white/5 p-4"><div className="flex justify-between text-sm text-slate-300"><span>{cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}</span><span>{formatPrice(cart.subtotal)}</span></div><div className="mt-3 border-t border-white/10 pt-3 flex justify-between"><span className="font-bold">Subtotal</span><span className="text-xl font-black">{formatPrice(cart.subtotal)}</span></div></div>
      <Link onClick={() => { if (cart.items.length) trackClientEvent({ eventName: 'begin_checkout', commerce: { currency: 'BDT', value: cart.subtotal, item_count: cart.itemCount, items: cart.items.map((item) => analyticsItem(item)) } }) }} href={cart.items.length ? '/order?source=cart' : '/products'} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-orange-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-orange-950/20 transition hover:bg-orange-300">Continue & confirm order →</Link>
      <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-300"><div className="rounded-lg bg-white/5 p-2 text-center">✓ Secure checkout</div><div className="rounded-lg bg-white/5 p-2 text-center">✓ Stock rechecked</div></div>
    </aside>
  </div>}
