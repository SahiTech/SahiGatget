import { OrderSuccessView } from '@/components/order/order-success'

export const metadata = {
  title: 'Order confirmed',
  description: 'Your SahiGadget Cash on Delivery order confirmation.',
  robots: { index: false, follow: false },
}

export default function OrderSuccessPage() {
  return <main className="min-h-[70vh] flex-1 bg-slate-50"><OrderSuccessView /></main>
}
