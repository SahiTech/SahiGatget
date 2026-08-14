import { TrackOrderForm } from '@/components/order/track-order-form'

export const metadata = {
  title: 'Track your order',
  description: 'Securely check your SahiGadget order status with your order number and mobile number.',
  robots: { index: false, follow: false },
}

export default function TrackOrderPage() {
  return <main className="min-h-[70vh] flex-1 bg-slate-50"><div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14"><TrackOrderForm /></div></main>
}
