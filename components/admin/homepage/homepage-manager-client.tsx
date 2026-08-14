'use client'

import { useState } from 'react'
import { Plus, Layout } from 'lucide-react'
import { getHomepageBanners } from '@/lib/admin/homepage-actions'
import type { HomepageBanner } from '@/lib/services/storefront-utils'
import { BannerList } from './banner-list'
import { BannerForm } from './banner-form'

export function HomepageManagerClient({ initialBanners }: { initialBanners: HomepageBanner[] }) {
  const [banners, setBanners] = useState<HomepageBanner[]>(initialBanners)
  const [editingBanner, setEditingBanner] = useState<HomepageBanner | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  async function refreshBanners() {
    const data = await getHomepageBanners()
    setBanners(data)
    setEditingBanner(null)
    setIsCreating(false)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500">
          <Layout className="h-4 w-4" /> Hero Banners
        </h2>
        {!isCreating && !editingBanner && (
          <button onClick={() => setIsCreating(true)} className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-950 px-4 text-xs font-bold text-white transition hover:bg-emerald-600">
            <Plus className="h-3.5 w-3.5" /> Add New Banner
          </button>
        )}
      </div>

      {(isCreating || editingBanner) && (
        <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm ring-4 ring-emerald-50">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-950">{editingBanner ? 'Edit Banner' : 'New Banner'}</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Banner Details</p>
          </div>
          <BannerForm 
            initialData={editingBanner} 
            onSuccess={refreshBanners} 
            onCancel={() => { setEditingBanner(null); setIsCreating(false); }} 
          />
        </section>
      )}

      <BannerList 
        banners={banners} 
        onEdit={setEditingBanner} 
        onRefresh={refreshBanners} 
      />
    </div>
  )
}
