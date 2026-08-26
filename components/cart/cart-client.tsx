'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { clearCartAction, removeCartItemAction, updateCartItemAction } from '@/lib/commerce/actions'
import { formatPrice } from '@/lib/services/storefront-utils'

type CartItem = { id: string; quantity: number; product?: { name: string; slug: string }; variant?: { sku: string; variant_title: string; price: number; is_in_stock: boolean } }
export function CartClient({ initialCart }: { initialCart: { items: CartItem[]; subtotal: number; itemCount: number } }) {
  const [cart, setCart] = useState(initialCart)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function run(action: () => Promise<{ ok: boolean; message?: string; data?: typeof initialCart }>) {
    setBusy(true); setMessage('')
    const result = await action()
    setBusy(false)
    if (!result.ok) { setMessage(result.message ?? 'Unable to update your cart.'); return }
    if (result.data) setCart(result.data)
  }
  return <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Your selection</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">Shopping cart</h1><p className="mt-2 text-sm text-slate-500">Prices and availability are rechecked securely before checkout.</p></div><ShoppingBag className="h-6 w-6 text-emerald-600" /></div>
      {message ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{message}</p> : null}
      {!cart.items.length ? <div className="py-16 text-center"><p className="text-lg font-black text-slate-950">Your cart is empty.</p><Link href="/products" className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white">Browse products</Link></div> : <div className="mt-6 space-y-3">{cart.items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"><div className="min-w-0 flex-1"><Link href={item.product?.slug ? `/products/${item.product.slug}` : '/products'} className="font-black text-slate-950 hover:text-emerald-700">{item.product?.name ?? 'Product'}</Link><p className="mt-1 text-xs text-slate-500">{item.variant?.variant_title || item.variant?.sku}</p><p className="mt-2 font-bold text-slate-900">{formatPrice(Number(item.variant?.price ?? 0))}</p></div><div className="flex items-center gap-2"><button type="button" disabled={busy || item.quantity <= 1} onClick={() => run(() => updateCartItemAction({ itemId: item.id, quantity: item.quantity - 1 }))} className="rounded-lg border p-2 disabled:opacity-40" aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button><span className="w-8 text-center font-black">{item.quantity}</span><button type="button" disabled={busy || item.quantity >= 10} onClick={() => run(() => updateCartItemAction({ itemId: item.id, quantity: item.quantity + 1 }))} className="rounded-lg border p-2 disabled:opacity-40" aria-label="Increase quantity"><Plus className="h-4 w-4" /></button><button type="button" disabled={busy} onClick={() => run(() => removeCartItemAction(item.id))} className="ml-2 rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label="Remove item"><Trash2 className="h-4 w-4" /></button></div></div>)}</div>}
      {cart.items.length ? <button type="button" disabled={busy} onClick={() => run(() => clearCartAction())} className="mt-6 text-sm font-bold text-slate-500 underline underline-offset-4">Clear cart</button> : null}
    </section>
    <aside className="h-fit rounded-[1.5rem] bg-slate-950 p-6 text-white lg:sticky lg:top-24"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Cart summary</p><div className="mt-6 flex justify-between text-sm text-slate-300"><span>{cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}</span><span>{formatPrice(cart.subtotal)}</span></div><div className="mt-4 border-t border-white/10 pt-4"><p className="text-xs leading-5 text-slate-400">Delivery is calculated from your location during the secure checkout quote.</p></div><Link href={cart.items.length ? '/order?source=cart' : '/products'} className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-emerald-300">Continue to checkout</Link></aside>
  </div>
}
