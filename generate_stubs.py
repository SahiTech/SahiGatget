import os

routes = [
    ("app/brands/page.tsx", "Brands Directory", "Browse official mobile phone brands like Samsung, Apple, Xiaomi, OnePlus, and more."),
    ("app/categories/page.tsx", "Categories Architecture", "Explore categories including official smartphones, feature phones, chargers, cables, and smart gadgets."),
    ("app/search/page.tsx", "Search Architecture", "Fast product search engine foundation with instant filtering and sorting."),
    ("app/order/page.tsx", "Direct Order Foundation", "Secure checkout and customer details form with server-side delivery calculation (Dhaka ৳80, Outside ৳130)."),
    ("app/order/success/page.tsx", "Order Confirmation", "Order successfully placed confirmation with professional invoice readiness."),
    ("app/track-order/page.tsx", "Order Tracking Foundation", "Track order status, delivery progression, and warranty information in real time."),
    ("app/admin/page.tsx", "Admin Portal", "Secure administrative control center for SahiGadget operations."),
    ("app/admin/login/page.tsx", "Admin Login", "Secure Supabase authentication gateway for owners, admins, and staff."),
    ("app/admin/dashboard/page.tsx", "Admin Dashboard", "Sales overview, today&apos;s orders, revenue analytics, and low-stock alerts."),
    ("app/admin/orders/page.tsx", "Order Management", "Manage customer orders, delivery status, and verification."),
    ("app/admin/products/page.tsx", "Product CRUD Management", "Manage product catalog, pricing, variants, and stock status."),
    ("app/admin/inventory/page.tsx", "Inventory & Stock Control", "Stock adjustments, IMEI/serial tracking, and inventory alerts."),
    ("app/admin/customers/page.tsx", "Customer & Order Records", "Customer information and order history records."),
    ("app/admin/settings/page.tsx", "Store Settings", "Configure delivery charges, warranty policies, and system settings.")
]

for path, title, description in routes:
    full_path = os.path.join("/home/ubuntu/sahigatget", path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    content = f"""import Link from 'next/link'
import {{ Button }} from '@/components/ui/button'
import {{ ArrowLeft, Layers }} from 'lucide-react'

export default function Page() {{
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
          </Button>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            Foundation Route
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-4">
            <Layers className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-2 text-slate-600 max-w-lg mx-auto text-sm">
            {description}
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href="/">Return to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}}
"""
    with open(full_path, "w") as f:
        f.write(content)

print("Generated all route stubs successfully.")
