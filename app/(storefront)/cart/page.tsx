import { CartClient } from '@/components/cart/cart-client'
import { getCart } from '@/lib/commerce/cart'

export const metadata = { title: 'Shopping Cart · SahiGadget' }

export default async function CartPage() {
  const cart = await getCart()
  return <main className="flex-1 bg-slate-50"><div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><CartClient initialCart={cart} /></div></main>
}
