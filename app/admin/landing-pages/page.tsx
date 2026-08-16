import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/auth'
import { AdminPageHeader, AdminShell } from '@/components/admin/admin-shell'
import { getAdminLandingPages } from '@/lib/landing-pages/data'
import { getProducts } from '@/lib/services/storefront'
import { LandingPageManagerClient } from '@/components/admin/landing-pages/landing-page-manager-client'

export const metadata: Metadata = { title: 'Landing Pages | SahiGadget Admin' }

export default async function AdminLandingPagesPage() {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  const [{ products }, pages] = await Promise.all([getProducts({ pageSize: 48 }), getAdminLandingPages()])
  return <AdminShell session={session}><AdminPageHeader eyebrow="Content Management" title="Landing Page Builder" description="Create structured product and campaign pages without duplicating catalogue, pricing, inventory, or order logic." /><LandingPageManagerClient initialPages={pages} products={products} /></AdminShell>
}
