'use client'

import Image from 'next/image'
import { useTransition } from 'react'
import { Edit2, Eye, EyeOff, Trash2 } from 'lucide-react'
import { deleteHomepageBanner, updateHomepageBanner } from '@/lib/admin/homepage-actions'
import type { HomepageBanner } from '@/lib/services/storefront-utils'

type BannerListProps = {
  banners: HomepageBanner[]
  onEdit: (banner: HomepageBanner) => void
  onRefresh: () => void
}

export function BannerList({ banners, onEdit, onRefresh }: BannerListProps) {
  const [isPending, startTransition] = useTransition()

  async function toggleActive(banner: HomepageBanner) {
    startTransition(async () => {
      await updateHomepageBanner(banner.id, { is_active: !banner.is_active })
      onRefresh()
    })
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this banner?')) return
    startTransition(async () => {
      await deleteHomepageBanner(id)
      onRefresh()
    })
  }

  if (banners.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No banners configured</p>
        <p className="mt-2 text-sm text-slate-400">Add your first hero banner to customize the homepage.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      {banners.map((banner) => (
        <div key={banner.id} className={`group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md ${!banner.is_active ? 'opacity-60 grayscale' : ''}`}>
          <div className="flex flex-col md:flex-row">
            <div className="relative h-40 w-full shrink-0 md:h-auto md:w-72 bg-slate-100">
              <Image src={banner.desktop_image_url} alt={banner.heading} fill unoptimized sizes="(max-width: 768px) 100vw, 288px" className="object-cover" />
              <div className="absolute left-3 top-3 rounded-full bg-slate-950/80 px-2 py-1 text-[10px] font-black text-white backdrop-blur">
                Order: {banner.sort_order}
              </div>
            </div>
            
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-950">{banner.heading}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{banner.description}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => toggleActive(banner)} disabled={isPending} className={`rounded-lg p-2 transition ${banner.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`} title={banner.is_active ? 'Deactivate' : 'Activate'}>
                    {banner.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => onEdit(banner)} disabled={isPending} className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950" title="Edit">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(banner.id)} disabled={isPending} className="rounded-lg p-2 text-rose-600 transition hover:bg-rose-50 hover:text-rose-700" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="mt-auto pt-4 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  Primary: {banner.primary_cta_text}
                </div>
                {banner.secondary_cta_text && (
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
                    Secondary: {banner.secondary_cta_text}
                  </div>
                )}
                <div className="ml-auto">
                  Updated: {new Date(banner.updated_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
