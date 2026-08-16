'use client'

import { useMemo, useState } from 'react'
import { Eye, FilePlus2, Globe2, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { createLandingPage, deleteLandingPage, setLandingPageStatus, updateLandingPage } from '@/lib/admin/landing-page-actions'
import type { LandingPage, LandingPageInput, LandingSection } from '@/lib/landing-pages/types'
import type { StorefrontProduct } from '@/lib/services/storefront-utils'

const blankSections: LandingSection[] = [
  { id: 'hero-1', type: 'hero', eyebrow: 'SahiGadget', title: 'Write a clear campaign promise', body: 'Explain the product or campaign in one focused paragraph.', ctaLabel: 'View product', ctaHref: '#product' },
  { id: 'features-1', type: 'features', title: 'Why customers choose it', items: [{ title: 'Authentic product', body: 'Use factual product information only.' }, { title: 'Nationwide delivery', body: 'Use current SahiGadget policy details.' }] },
]

function blankInput(): LandingPageInput {
  return { slug: '', internal_name: '', page_type: 'product', status: 'draft', linked_product_id: '', hero_image_url: '', mobile_hero_image_url: '', og_image_url: '', sections: blankSections, seo_title: '', seo_description: '', noindex: true, starts_at: null, ends_at: null, linked_product_ids: [] }
}

export function LandingPageManagerClient({ initialPages, products }: { initialPages: LandingPage[]; products: StorefrontProduct[] }) {
  const [pages] = useState(initialPages)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<LandingPageInput>(blankInput())
  const [sectionsText, setSectionsText] = useState(JSON.stringify(blankSections, null, 2))
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  const editingPage = useMemo(() => pages.find((page) => page.id === editingId) ?? null, [editingId, pages])

  function startCreate() {
    setEditingId(null)
    const next = blankInput()
    setForm(next)
    setSectionsText(JSON.stringify(next.sections, null, 2))
    setFeedback('')
  }

  function startEdit(page: LandingPage) {
    const next: LandingPageInput = { slug: page.slug, internal_name: page.internal_name, page_type: page.page_type, status: page.status, linked_product_id: page.linked_product_id, hero_image_url: page.hero_image_url, mobile_hero_image_url: page.mobile_hero_image_url, og_image_url: page.og_image_url, sections: page.sections, seo_title: page.seo_title, seo_description: page.seo_description, noindex: page.noindex, starts_at: page.starts_at, ends_at: page.ends_at, linked_product_ids: page.linked_products?.map((item) => item.product_id) ?? [] }
    setEditingId(page.id)
    setForm(next)
    setSectionsText(JSON.stringify(next.sections, null, 2))
    setFeedback('')
  }

  async function submit() {
    setBusy(true)
    setFeedback('')
    try {
      const sections = JSON.parse(sectionsText) as LandingSection[]
      if (!Array.isArray(sections)) throw new Error('Sections must be a JSON array.')
      const payload = { ...form, sections, linked_product_ids: form.linked_product_id ? [form.linked_product_id, ...(form.linked_product_ids ?? []).filter((id) => id !== form.linked_product_id)] : form.linked_product_ids }
      const result = editingId ? await updateLandingPage(editingId, payload) : await createLandingPage(payload)
      setFeedback(result.message)
      if (result.ok) {
        const refreshed = await fetch('/api/search?q=' + encodeURIComponent('')).catch(() => null)
        void refreshed
        window.location.reload()
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'The landing page could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(page: LandingPage, status: 'draft' | 'published' | 'archived') {
    setBusy(true)
    const result = await setLandingPageStatus(page.id, status)
    setFeedback(result.message)
    setBusy(false)
    if (result.ok) window.location.reload()
  }

  async function remove(page: LandingPage) {
    if (!window.confirm(`Delete “${page.internal_name}”? This removes only the landing-page record.`)) return
    setBusy(true)
    const result = await deleteLandingPage(page.id)
    setFeedback(result.message)
    setBusy(false)
    if (result.ok) window.location.reload()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Structured pages</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Landing page library</h2></div><button type="button" onClick={startCreate} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-emerald-700"><FilePlus2 className="h-4 w-4" /> New landing page</button></div>
        <div className="space-y-3">{pages.map((page) => <article key={page.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-bold text-slate-950">{page.internal_name}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{page.status}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">{page.page_type}</span></div><p className="mt-2 text-sm text-slate-500">/landing/{page.slug} · {page.sections.length} sections</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => startEdit(page)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-emerald-300"><Pencil className="h-3.5 w-3.5" /> Edit</button>{page.status === 'published' ? <button type="button" disabled={busy} onClick={() => changeStatus(page, 'draft')} className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-200 px-3 text-xs font-bold text-amber-700 hover:bg-amber-50">Unpublish</button> : <button type="button" disabled={busy} onClick={() => changeStatus(page, 'published')} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-800"><Globe2 className="h-3.5 w-3.5" /> Publish</button>}<button type="button" disabled={busy} onClick={() => remove(page)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button></div></div><div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500"><span>{page.noindex ? 'No index' : 'Indexable'}</span>{page.starts_at ? <span>Starts {new Date(page.starts_at).toLocaleString()}</span> : null}{page.ends_at ? <span>Ends {new Date(page.ends_at).toLocaleString()}</span> : null}{page.status === 'published' && !page.noindex ? <a className="font-bold text-emerald-700 hover:underline" href={`/landing/${page.slug}`} target="_blank" rel="noreferrer"><Eye className="mr-1 inline h-3.5 w-3.5" /> Preview</a> : null}</div></article>)}{!pages.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="font-bold text-slate-800">No landing pages yet.</p><p className="mt-2 text-sm text-slate-500">Create a product or campaign page using the structured builder.</p></div> : null}</div>
      </section>
      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm xl:sticky xl:top-24 xl:self-start"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Builder</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{editingPage ? 'Edit landing page' : 'Create landing page'}</h2></div><button type="button" onClick={startCreate} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label="Clear builder"><Plus className="h-4 w-4" /></button></div><div className="mt-5 space-y-4"><label className="block text-sm font-semibold text-slate-700">Internal name<input value={form.internal_name} onChange={(e) => setForm({ ...form, internal_name: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="Samsung Guru Music 2 campaign" /></label><label className="block text-sm font-semibold text-slate-700">URL slug<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="samsung-guru-music-2" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold text-slate-700">Page type<select value={form.page_type} onChange={(e) => setForm({ ...form, page_type: e.target.value as LandingPageInput['page_type'] })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"><option value="product">Product</option><option value="campaign">Campaign</option></select></label><label className="block text-sm font-semibold text-slate-700">Linked product<select value={form.linked_product_id ?? ''} onChange={(e) => setForm({ ...form, linked_product_id: e.target.value || null })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"><option value="">No single product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label></div><label className="block text-sm font-semibold text-slate-700">Hero image URL<input value={form.hero_image_url ?? ''} onChange={(e) => setForm({ ...form, hero_image_url: e.target.value || null })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="https://..." /></label><label className="block text-sm font-semibold text-slate-700">Mobile hero image URL<input value={form.mobile_hero_image_url ?? ''} onChange={(e) => setForm({ ...form, mobile_hero_image_url: e.target.value || null })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="Optional responsive image" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold text-slate-700">Starts at<input type="datetime-local" value={form.starts_at ? form.starts_at.slice(0, 16) : ''} onChange={(e) => setForm({ ...form, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label><label className="block text-sm font-semibold text-slate-700">Ends at<input type="datetime-local" value={form.ends_at ? form.ends_at.slice(0, 16) : ''} onChange={(e) => setForm({ ...form, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label></div><label className="block text-sm font-semibold text-slate-700">SEO title<input value={form.seo_title ?? ''} onChange={(e) => setForm({ ...form, seo_title: e.target.value || null })} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label><label className="block text-sm font-semibold text-slate-700">SEO description<textarea value={form.seo_description ?? ''} onChange={(e) => setForm({ ...form, seo_description: e.target.value || null })} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm" /></label><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.noindex} onChange={(e) => setForm({ ...form, noindex: e.target.checked })} /> Keep this page out of search engines while drafting</label><label className="block text-sm font-semibold text-slate-700">Structured sections (JSON)<textarea value={sectionsText} onChange={(e) => setSectionsText(e.target.value)} rows={15} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-xs text-emerald-100" aria-describedby="section-help" /><span id="section-help" className="mt-1 block text-xs font-normal text-slate-500">Use the provided section types only. The server validates the array length and page linkage.</span></label>{feedback ? <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800" role="status">{feedback}</p> : null}<button type="button" disabled={busy} onClick={submit} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"><Save className="h-4 w-4" />{busy ? 'Saving…' : editingPage ? 'Save changes' : 'Create page'}</button></div></section>
    </div>
  )
}
