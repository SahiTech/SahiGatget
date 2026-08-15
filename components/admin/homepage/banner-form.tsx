'use client'

import { useState, useTransition, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, Save, X, RefreshCw, Trash2, Link2, MousePointerClick } from 'lucide-react'

import { bannerSchema } from '@/lib/admin/schema'
import { createHomepageBanner, updateHomepageBanner, uploadBannerImageAction } from '@/lib/admin/homepage-actions'

const inputClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100'
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-600'

type BannerRecord = {
  id?: string
  desktop_image_url?: string | null
  mobile_image_url?: string | null
  heading?: string | null
  description?: string | null
  primary_cta_text?: string | null
  primary_cta_url?: string | null
  is_active?: boolean | null
  sort_order?: number | null
}

type BannerFormValues = z.input<typeof bannerSchema>

type BannerFormProps = { initialData?: BannerRecord | null; onSuccess: () => void; onCancel?: () => void }

export function BannerForm({ initialData, onSuccess, onCancel }: BannerFormProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>(initialData?.desktop_image_url || initialData?.mobile_image_url || '')

  const form = useForm<BannerFormValues>({
    resolver: zodResolver(bannerSchema),
    defaultValues: initialData
      ? {
          id: initialData.id,
          desktopImageUrl: initialData.desktop_image_url || initialData.mobile_image_url || '',
          mobileImageUrl: initialData.mobile_image_url || initialData.desktop_image_url || '',
          heading: initialData.heading || 'Homepage Promotion',
          description: initialData.description || 'Promotional banner',
          primaryCtaText: initialData.primary_cta_text || 'Open',
          primaryCtaUrl: initialData.primary_cta_url || '/products',
          secondaryCtaText: '', secondaryCtaUrl: '',
          isActive: initialData.is_active ?? true, sortOrder: initialData.sort_order ?? 0,
        }
      : {
          desktopImageUrl: '', mobileImageUrl: '', heading: 'Homepage Promotion', description: 'Promotional banner',
          primaryCtaText: 'Open', primaryCtaUrl: '/products', secondaryCtaText: '', secondaryCtaUrl: '',
          isActive: true, sortOrder: 0,
        },
  })

  useEffect(() => () => {
    if (bannerFile && preview.startsWith('blob:')) URL.revokeObjectURL(preview)
  }, [bannerFile, preview])

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
      setMessage('Use a JPEG, PNG, WebP, or AVIF image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image size must be less than 5MB.')
      return
    }
    if (bannerFile && preview.startsWith('blob:')) URL.revokeObjectURL(preview)
    const objectUrl = URL.createObjectURL(file)
    setBannerFile(file); setPreview(objectUrl)
    form.setValue('desktopImageUrl', objectUrl, { shouldValidate: true })
    form.setValue('mobileImageUrl', objectUrl, { shouldValidate: true })
    form.clearErrors(['desktopImageUrl', 'mobileImageUrl']); setMessage(null); event.target.value = ''
  }

  function removeImage() {
    if (bannerFile && preview.startsWith('blob:')) URL.revokeObjectURL(preview)
    setBannerFile(null); setPreview('')
    form.setValue('desktopImageUrl', '', { shouldValidate: true })
    form.setValue('mobileImageUrl', '', { shouldValidate: true })
  }

  const onSubmit = (values: BannerFormValues) => {
    startTransition(async () => {
      try {
        setMessage('Uploading optimized banner image...')
        let finalImageUrl = values.desktopImageUrl
        if (bannerFile) {
          const formData = new FormData(); formData.append('file', bannerFile); formData.append('type', 'hero')
          const upload = await uploadBannerImageAction(formData)
          if (!upload.ok || !upload.url) { setMessage(upload.message || 'Banner image upload failed.'); return }
          finalImageUrl = upload.url
        }
        if (!finalImageUrl) { setMessage('Please choose a banner image.'); return }
        const destination = String(values.primaryCtaUrl || '').trim() || '/products'
        const payload = {
          desktop_image_url: finalImageUrl, mobile_image_url: finalImageUrl,
          heading: 'Homepage Promotion', description: 'Promotional banner', primary_cta_text: 'Open', primary_cta_url: destination,
          secondary_cta_text: null, secondary_cta_url: null, is_active: Boolean(values.isActive), sort_order: Number(values.sortOrder) || 0,
        }
        const result = values.id ? await updateHomepageBanner(values.id, payload) : await createHomepageBanner(payload)
        if (!result.ok) { setMessage(result.message); return }
        setMessage(values.id ? 'Banner updated successfully.' : 'Banner created successfully.')
        window.setTimeout(onSuccess, 500)
      } catch (error: unknown) { setMessage(error instanceof Error ? error.message : 'Banner save failed.') }
    })
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <input type="hidden" {...form.register('desktopImageUrl')} /><input type="hidden" {...form.register('mobileImageUrl')} />
      <input type="hidden" {...form.register('heading')} /><input type="hidden" {...form.register('description')} />
      <input type="hidden" {...form.register('primaryCtaText')} /><input type="hidden" {...form.register('secondaryCtaText')} /><input type="hidden" {...form.register('secondaryCtaUrl')} />

      <section className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5">
        <div className="flex items-start gap-3"><MousePointerClick className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div>
          <h3 className="text-sm font-black text-slate-950">Image-first banner</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">The storefront shows the uploaded artwork without heading, description, CTA button, or extra overlay. Customers can click/tap the banner itself.</p>
        </div></div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3"><div><label className={labelClass}>Homepage Banner Image</label><p className="text-xs text-slate-500">Recommended: wide artwork around 2.8:1. The same image is used on mobile and desktop.</p></div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">One image</span></div>
        {preview ? <div className="space-y-3">
          <div className="relative aspect-[2.8/1] overflow-hidden rounded-xl border bg-slate-950"><img src={preview} alt="Banner preview" className="h-full w-full object-cover" /></div>
          {bannerFile ? <p className="truncate text-xs text-slate-500"><span className="font-bold text-slate-700">{bannerFile.name}</span> · {Math.round(bannerFile.size / 1024)} KB</p> : null}
          <div className="flex flex-wrap gap-2"><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"><RefreshCw className="h-3.5 w-3.5" /> Change Image<input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleFileSelect} /></label><button type="button" onClick={removeImage} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /> Remove</button></div>
        </div> : <label className="flex aspect-[2.8/1] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 hover:border-emerald-500 hover:bg-emerald-50/50"><ImagePlus className="h-8 w-8 text-slate-400" /><span className="mt-2 text-xs font-bold text-slate-700">Choose Banner Image</span><span className="mt-1 text-[10px] text-slate-400">JPEG, PNG, WebP, or AVIF · max 5MB</span><input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleFileSelect} /></label>}
        {(form.formState.errors.desktopImageUrl || form.formState.errors.mobileImageUrl) ? <p className="text-xs text-rose-600">Banner image is required.</p> : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-emerald-600" /><h3 className="text-sm font-black text-slate-900">Click destination</h3></div><div><label className={labelClass}>Where should this banner open?</label><input className={inputClass} {...form.register('primaryCtaUrl')} placeholder="/products, /categories/feature-phones, or a full URL" /><p className="mt-1.5 text-[11px] leading-5 text-slate-500">The whole banner is clickable. Choose the destination here in Admin.</p>{form.formState.errors.primaryCtaUrl ? <p className="mt-1 text-xs text-rose-600">Enter a destination.</p> : null}</div></section>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-6"><label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" {...form.register('isActive')} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /> Active banner</label><div className="flex items-center gap-3"><label className="text-xs font-bold uppercase tracking-wider text-slate-500">Order</label><input type="number" min="0" className="h-9 w-20 rounded-lg border border-slate-200 px-3 text-sm" {...form.register('sortOrder')} /></div></div><div className="flex items-center gap-3">{onCancel ? <button type="button" onClick={onCancel} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"><X className="h-4 w-4" /> Cancel</button> : null}<button type="submit" disabled={isPending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-black text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"><Save className="h-4 w-4" /> {isPending ? 'Saving...' : 'Save Banner'}</button></div></div>
      {message ? <p role="status" className="rounded-xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">{message}</p> : null}
    </form>
  )
}
