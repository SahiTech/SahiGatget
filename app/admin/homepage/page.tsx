import { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/auth'
import { AdminShell, AdminPageHeader } from '@/components/admin/admin-shell'
import { getHomepageBanners } from '@/lib/admin/homepage-actions'
import { HomepageManagerClient } from '@/components/admin/homepage/homepage-manager-client'

export const metadata: Metadata = {
  title: 'Homepage Management | SahiGadget Admin',
}

export default async function AdminHomepagePage() {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  const banners = await getHomepageBanners()

  return (
    <AdminShell session={session}>
      <AdminPageHeader 
        eyebrow="Content Management"
        title="Homepage CMS"
        description="Manage your storefront hero banners, promotional slides, and marketing messaging."
      />
      
      <HomepageManagerClient initialBanners={banners} />
    </AdminShell>
  )
}
