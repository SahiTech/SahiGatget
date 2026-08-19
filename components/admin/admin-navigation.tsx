'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Boxes, ClipboardList, LayoutDashboard, PackageSearch, Settings2, UsersRound, Layout, MessageSquareText, Bot, Truck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { AdminRole } from '@/lib/admin/auth'

const navigation: { href: string; label: string; icon: LucideIcon; roles: readonly AdminRole[] }[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { href: '/admin/homepage', label: 'Homepage', icon: Layout, roles: ['OWNER', 'ADMIN'] },
  { href: '/admin/landing-pages', label: 'Landing Pages', icon: Layout, roles: ['OWNER', 'ADMIN'] },
  { href: '/admin/products', label: 'Catalogue', icon: PackageSearch, roles: ['OWNER', 'ADMIN'] },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes, roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { href: '/admin/orders', label: 'Orders', icon: ClipboardList, roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { href: '/admin/delivery', label: 'Delivery', icon: Truck, roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { href: '/admin/customers', label: 'Customers', icon: UsersRound, roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { href: '/admin/support', label: 'Customer Support', icon: MessageSquareText, roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { href: '/admin/ai-assistant', label: 'AI Assistant', icon: Bot, roles: ['OWNER', 'ADMIN'] },
  { href: '/admin/settings', label: 'Settings', icon: Settings2, roles: ['OWNER', 'ADMIN'] },
]

export function AdminNavigation({ role }: { role: AdminRole }) {
  const pathname = usePathname()
  return (
    <nav className="space-y-1" aria-label="Admin navigation">
      {navigation.filter((item) => item.roles.includes(role)).map((item) => {
        const Icon = item.icon
        const isActive = item.href === '/admin' ? pathname === '/admin' || pathname === '/admin/dashboard' : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${isActive ? 'bg-emerald-500/15 text-white ring-1 ring-emerald-400/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
          >
            <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-300' : 'text-emerald-400'}`} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
