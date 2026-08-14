'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, Save, X } from 'lucide-react'

import { bannerSchema, type BannerInput } from '@/lib/admin/schema'
import { createHomepageBanner, updateHomepageBanner, uploadBannerImage } from '@/lib/admin/homepage-actions'

const inputClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100'
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-600'

type BannerFormProps = {
  initialData?: any
  onSuccess: () => void
  onCancel?: () => void
}

export function BannerForm({ initialData, onSuccess, onCancel }: BannerFormProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  
  const form = useForm<any>({
    resolver: zodResolver(bannerSchema),
    defaultValues: initialData ? {
      id: initialData.id,
      desktopImageUrl: initialData.desktop_image_url,
      mobileImageUrl: initialData.mobile_image_url,
      heading: initialData.heading,
      description: initialData.description,
      primaryCtaText: initialData.primary_cta_text,
      primaryCtaUrl: initialData.primary_cta_url,
      secondaryCtaText: initialData.secondary_cta_text || '',
      secondaryCtaUrl: initialData.secondary_cta_url || '',
      isActive: initialData.is_active,
      sortOrder: initialData.sort_order,
    } : {
      heading: '',
      description: '',
      primaryCtaText: 'Shop Now',
      primaryCtaUrl: '/products',
      secondaryCtaText: '',
      secondaryCtaUrl: '',
      isActive: true,
      sortOrder: 0,
      desktopImageUrl: '',
      mobileImageUrl: '',
    }
  })

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>, field: 'desktopImageUrl' | 'mobileImageUrl') {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const path = `banners/${Date.now()}-${file.name}`
      const url = await uploadBannerImage(file, path)
      form.setValue(field, url)
    } catch (error) {
      alert('Failed to upload image.')
    }
  }

  const onSubmit = (values: BannerInput) => {
    startTransition(async () => {
      try {
        const payload = {
          desktop_image_url: values.desktopImageUrl,
          mobile_image_url: values.mobileImageUrl,
          heading: values.heading,
          description: values.description,
          primary_cta_text: values.primaryCtaText,
          primary_cta_url: values.primaryCtaUrl,
          secondary_cta_text: values.secondaryCtaText || null,
          secondary_cta_url: values.secondaryCtaUrl || null,
          is_active: values.isActive,
          sort_order: values.sortOrder,
        }

        if (values.id) {
          await updateHomepageBanner(values.id, payload)
          setMessage('Banner updated successfully.')
        } else {
          await createHomepageBanner(payload)
          setMessage('Banner created successfully.')
          form.reset()
        }
        
        setTimeout(() => {
          onSuccess()
        }, 1000)
      } catch (error: any) {
        setMessage(error.message || 'An error occurred.')
      }
    })
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Visual Assets</h3>
          
          <div>
            <label className={labelClass}>Desktop Image (Wide)</label>
            <div className="mt-2 flex items-center gap-4">
              {form.watch('desktopImageUrl') && (
                <img src={form.watch('desktopImageUrl')} alt="Desktop preview" className="h-20 w-40 rounded-lg border object-cover" />
              )}
              <label className="flex h-20 w-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100">
                <ImagePlus className="h-6 w-6 text-slate-400" />
                <span className="mt-1 text-[10px] font-bold text-slate-500 uppercase">Upload Desktop</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'desktopImageUrl')} />
              </label>
            </div>
            <input type="hidden" {...form.register('desktopImageUrl')} />
            {form.formState.errors.desktopImageUrl && <p className="mt-1 text-xs text-rose-600">Desktop image is required</p>}
          </div>

          <div>
            <label className={labelClass}>Mobile Image (Portrait/Square)</label>
            <div className="mt-2 flex items-center gap-4">
              {form.watch('mobileImageUrl') && (
                <img src={form.watch('mobileImageUrl')} alt="Mobile preview" className="h-20 w-20 rounded-lg border object-cover" />
              )}
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100">
                <ImagePlus className="h-6 w-6 text-slate-400" />
                <span className="mt-1 text-[10px] font-bold text-slate-500 uppercase text-center px-1">Upload Mobile</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'mobileImageUrl')} />
              </label>
            </div>
            <input type="hidden" {...form.register('mobileImageUrl')} />
            {form.formState.errors.mobileImageUrl && <p className="mt-1 text-xs text-rose-600">Mobile image is required</p>}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Content</h3>
          
          <div>
            <label className={labelClass}>Heading</label>
            <input className={inputClass} {...form.register('heading')} placeholder="e.g. New iPhone 15 Pro" />
            {form.formState.errors.heading && <p className="mt-1 text-xs text-rose-600">{String(form.formState.errors.heading.message)}</p>}
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea className="min-h-[80px] w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" {...form.register('description')} placeholder="Compelling marketing copy..." />
            {form.formState.errors.description && <p className="mt-1 text-xs text-rose-600">{String(form.formState.errors.description.message)}</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Primary Action</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>CTA Text</label>
              <input className={inputClass} {...form.register('primaryCtaText')} />
            </div>
            <div>
              <label className={labelClass}>CTA URL</label>
              <input className={inputClass} {...form.register('primaryCtaUrl')} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Secondary Action (Optional)</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>CTA Text</label>
              <input className={inputClass} {...form.register('secondaryCtaText')} />
            </div>
            <div>
              <label className={labelClass}>CTA URL</label>
              <input className={inputClass} {...form.register('secondaryCtaUrl')} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-6">
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <input type="checkbox" {...form.register('isActive')} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            Active Slide
          </label>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Order</label>
            <input type="number" className="h-9 w-20 rounded-lg border border-slate-200 px-3 text-sm" {...form.register('sortOrder')} />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {onCancel && (
            <button type="button" onClick={onCancel} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">
              <X className="h-4 w-4" /> Cancel
            </button>
          )}
          <button type="submit" disabled={isPending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-6 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-50">
            <Save className="h-4 w-4" /> {isPending ? 'Saving...' : initialData ? 'Update Banner' : 'Create Banner'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg p-4 text-sm font-bold ${message.includes('success') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {message}
        </div>
      )}
    </form>
  )
}
