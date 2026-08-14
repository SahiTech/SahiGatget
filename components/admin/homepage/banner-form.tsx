'use client'

import { useState, useTransition, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, Save, X, RefreshCw, Trash2 } from 'lucide-react'

import { bannerSchema } from '@/lib/admin/schema'
import { createHomepageBanner, updateHomepageBanner, uploadBannerImageAction } from '@/lib/admin/homepage-actions'

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

  // Local file state for desktop & mobile
  const [desktopFile, setDesktopFile] = useState<File | null>(null)
  const [desktopPreview, setDesktopPreview] = useState<string>(initialData?.desktop_image_url || '')
  
  const [mobileFile, setMobileFile] = useState<File | null>(null)
  const [mobilePreview, setMobilePreview] = useState<string>(initialData?.mobile_image_url || '')

  const form = useForm<any>({
    resolver: zodResolver(bannerSchema),
    defaultValues: initialData ? {
      id: initialData.id,
      desktopImageUrl: initialData.desktop_image_url || '',
      mobileImageUrl: initialData.mobile_image_url || '',
      heading: initialData.heading || '',
      description: initialData.description || '',
      primaryCtaText: initialData.primary_cta_text || 'Shop Now',
      primaryCtaUrl: initialData.primary_cta_url || '/products',
      secondaryCtaText: initialData.secondary_cta_text || '',
      secondaryCtaUrl: initialData.secondary_cta_url || '',
      isActive: initialData.is_active ?? true,
      sortOrder: initialData.sort_order ?? 0,
    } : {
      heading: '',
      description: '',
      primaryCtaText: 'Shop Now',
      primaryCtaUrl: '/products',
      secondaryCtaText: '',
      secondaryCtaUrl: '',
      isActive: true,
      sortOrder: 0,
      desktopImageUrl: initialData?.desktop_image_url || '',
      mobileImageUrl: initialData?.mobile_image_url || '',
    }
  })

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (desktopFile && desktopPreview.startsWith('blob:')) URL.revokeObjectURL(desktopPreview)
      if (mobileFile && mobilePreview.startsWith('blob:')) URL.revokeObjectURL(mobilePreview)
    }
  }, [desktopFile, desktopPreview, mobileFile, mobilePreview])

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>, type: 'desktop' | 'mobile') {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB.')
      return
    }

    const objectUrl = URL.createObjectURL(file)

    if (type === 'desktop') {
      if (desktopFile && desktopPreview.startsWith('blob:')) URL.revokeObjectURL(desktopPreview)
      setDesktopFile(file)
      setDesktopPreview(objectUrl)
      form.setValue('desktopImageUrl', objectUrl)
      form.clearErrors('desktopImageUrl')
    } else {
      if (mobileFile && mobilePreview.startsWith('blob:')) URL.revokeObjectURL(mobilePreview)
      setMobileFile(file)
      setMobilePreview(objectUrl)
      form.setValue('mobileImageUrl', objectUrl)
      form.clearErrors('mobileImageUrl')
    }

    event.target.value = ''
  }

  function handleRemoveFile(type: 'desktop' | 'mobile') {
    if (type === 'desktop') {
      if (desktopFile && desktopPreview.startsWith('blob:')) URL.revokeObjectURL(desktopPreview)
      setDesktopFile(null)
      setDesktopPreview('')
      form.setValue('desktopImageUrl', '')
    } else {
      if (mobileFile && mobilePreview.startsWith('blob:')) URL.revokeObjectURL(mobilePreview)
      setMobileFile(null)
      setMobilePreview('')
      form.setValue('mobileImageUrl', '')
    }
  }

  const onSubmit = (values: any) => {
    startTransition(async () => {
      try {
        setMessage('Uploading images & saving banner...')

        let finalDesktopUrl = values.desktopImageUrl
        let finalMobileUrl = values.mobileImageUrl

        // Upload desktop file via Server Action
        if (desktopFile) {
          const formData = new FormData()
          formData.append('file', desktopFile)
          formData.append('type', 'desktop')

          const res = await uploadBannerImageAction(formData)
          if (!res.ok || !res.url) {
            setMessage(res.message || 'Desktop image upload failed.')
            return
          }
          finalDesktopUrl = res.url
        }

        // Upload mobile file via Server Action
        if (mobileFile) {
          const formData = new FormData()
          formData.append('file', mobileFile)
          formData.append('type', 'mobile')

          const res = await uploadBannerImageAction(formData)
          if (!res.ok || !res.url) {
            setMessage(res.message || 'Mobile image upload failed.')
            return
          }
          finalMobileUrl = res.url
        }

        if (!finalDesktopUrl || !finalMobileUrl) {
          setMessage('Both desktop and mobile images are required.')
          return
        }

        const payload = {
          desktop_image_url: finalDesktopUrl,
          mobile_image_url: finalMobileUrl,
          heading: values.heading,
          description: values.description,
          primary_cta_text: values.primaryCtaText,
          primary_cta_url: values.primaryCtaUrl,
          secondary_cta_text: values.secondaryCtaText || null,
          secondary_cta_url: values.secondaryCtaUrl || null,
          is_active: values.isActive,
          sort_order: Number(values.sortOrder) || 0,
        }

        let res
        if (values.id) {
          res = await updateHomepageBanner(values.id, payload)
        } else {
          res = await createHomepageBanner(payload)
        }

        if (!res.ok) {
          setMessage(res.message)
          return
        }

        setMessage(values.id ? 'Banner updated successfully!' : 'Banner created successfully!')
        if (!values.id) {
          form.reset()
          setDesktopFile(null)
          setDesktopPreview('')
          setMobileFile(null)
          setMobilePreview('')
        }
        
        setTimeout(() => {
          onSuccess()
        }, 800)
      } catch (error: any) {
        console.error('Banner submission error:', error)
        setMessage(error.message || 'An error occurred during banner creation.')
      }
    })
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Desktop Image Section */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className={labelClass}>Desktop Image (Wide 16:9)</label>
          <input type="hidden" {...form.register('desktopImageUrl')} />
          
          {desktopPreview ? (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border bg-white aspect-video">
                <img src={desktopPreview} alt="Desktop preview" className="h-full w-full object-cover" />
              </div>
              {desktopFile && (
                <div className="text-xs text-slate-500 truncate">
                  <span className="font-bold text-slate-700">{desktopFile.name}</span> ({Math.round(desktopFile.size / 1024)} KB)
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-slate-800">
                  <RefreshCw className="h-3.5 w-3.5" /> Change Image
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e, 'desktop')} />
                </label>
                <button type="button" onClick={() => handleRemoveFile('desktop')} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="flex h-36 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 transition hover:border-emerald-500 hover:bg-emerald-50/50">
              <ImagePlus className="h-8 w-8 text-slate-400" />
              <span className="mt-2 text-xs font-bold text-slate-700">Choose Desktop Image</span>
              <span className="mt-1 text-[10px] text-slate-400">PNG, JPG, WEBP up to 5MB</span>
              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e, 'desktop')} />
            </label>
          )}
          {form.formState.errors.desktopImageUrl && <p className="text-xs text-rose-600">Desktop image is required</p>}
        </div>

        {/* Mobile Image Section */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className={labelClass}>Mobile Image (Portrait/Square)</label>
          <input type="hidden" {...form.register('mobileImageUrl')} />
          
          {mobilePreview ? (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border bg-white aspect-video max-h-40">
                <img src={mobilePreview} alt="Mobile preview" className="h-full w-full object-cover" />
              </div>
              {mobileFile && (
                <div className="text-xs text-slate-500 truncate">
                  <span className="font-bold text-slate-700">{mobileFile.name}</span> ({Math.round(mobileFile.size / 1024)} KB)
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-slate-800">
                  <RefreshCw className="h-3.5 w-3.5" /> Change Image
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e, 'mobile')} />
                </label>
                <button type="button" onClick={() => handleRemoveFile('mobile')} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="flex h-36 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 transition hover:border-emerald-500 hover:bg-emerald-50/50">
              <ImagePlus className="h-8 w-8 text-slate-400" />
              <span className="mt-2 text-xs font-bold text-slate-700">Choose Mobile Image</span>
              <span className="mt-1 text-[10px] text-slate-400">PNG, JPG, WEBP up to 5MB</span>
              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e, 'mobile')} />
            </label>
          )}
          {form.formState.errors.mobileImageUrl && <p className="text-xs text-rose-600">Mobile image is required</p>}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">Banner Content</h3>
        
        <div>
          <label className={labelClass}>Heading</label>
          <input className={inputClass} {...form.register('heading')} placeholder="e.g. Essential Picks" />
          {form.formState.errors.heading && <p className="mt-1 text-xs text-rose-600">{String(form.formState.errors.heading.message)}</p>}
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea className="min-h-[80px] w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" {...form.register('description')} placeholder="e.g. Up to 56% off" />
          {form.formState.errors.description && <p className="mt-1 text-xs text-rose-600">{String(form.formState.errors.description.message)}</p>}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
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

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
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

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
            <input type="checkbox" {...form.register('isActive')} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            Active Slide
          </label>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Sort Order</label>
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
            <Save className="h-4 w-4" /> {isPending ? 'Saving Banner...' : initialData ? 'Update Banner' : 'Create Banner'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg p-4 text-sm font-bold ${message.includes('success') || message.includes('Uploading') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {message}
        </div>
      )}
    </form>
  )
}
