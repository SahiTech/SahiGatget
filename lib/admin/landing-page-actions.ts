'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminLandingPages } from '@/lib/landing-pages/data'
import { validateLandingPageInput, type LandingPageInput } from '@/lib/landing-pages/types'

export type LandingPageActionResult = { ok: boolean; message: string; id?: string; url?: string }

function failure(error: unknown): LandingPageActionResult {
  if (error instanceof Error && error.message === 'ADMIN_FORBIDDEN') return { ok: false, message: 'You do not have permission for this operation.' }
  return { ok: false, message: error instanceof Error ? error.message : 'The landing-page operation could not be completed.' }
}

function refreshLandingPageRoutes(slug?: string) {
  revalidatePath('/admin/landing-pages')
  revalidatePath('/sitemap.xml')
  if (slug) revalidatePath(`/landing/${slug}`)
}

async function saveLinkedProducts(db: ReturnType<typeof createAdminClient>, pageId: string, productIds: string[]) {
  await db.from('landing_page_products').delete().eq('landing_page_id', pageId)
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)))
  if (!uniqueIds.length) return
  const { error } = await db.from('landing_page_products').insert(uniqueIds.map((productId, index) => ({ landing_page_id: pageId, product_id: productId, sort_order: index })))
  if (error) throw new Error('Unable to save linked products.')
}

export async function listAdminLandingPages() {
  await requireAdmin(['OWNER', 'ADMIN'])
  return getAdminLandingPages()
}

export async function uploadLandingPageMediaAction(formData: FormData): Promise<LandingPageActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const file = formData.get('file') as File | null
    if (!file || !file.size) return { ok: false, message: 'Choose an image file first.' }
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
    if (!allowedTypes.has(file.type) || file.size > 8 * 1024 * 1024) return { ok: false, message: 'Use a JPEG, PNG, WebP, or AVIF image up to 8 MB.' }
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1] || 'jpg'
    const path = `pages/${session.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`
    const db = createAdminClient()
    const upload = await db.storage.from('landing-pages').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
    if (upload.error) throw new Error('The landing-page image could not be uploaded.')
    const { data } = db.storage.from('landing-pages').getPublicUrl(upload.data.path)
    return { ok: true, message: 'Landing-page image uploaded.', url: data.publicUrl }
  } catch (error) {
    return failure(error)
  }
}

export async function createLandingPage(input: LandingPageInput): Promise<LandingPageActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const payload = validateLandingPageInput(input)
    const { linked_product_ids: linkedProductIds = [], ...pagePayload } = payload
    const db = createAdminClient()
    const { data, error } = await db.from('landing_pages').insert({ ...pagePayload, published_at: payload.status === 'published' ? new Date().toISOString() : null, created_by: session.userId, updated_by: session.userId }).select('id,slug').single()
    if (error) throw new Error(error.message.includes('landing_pages_slug_key') ? 'That landing-page slug is already in use.' : 'The landing page could not be created.')
    await saveLinkedProducts(db, data.id, linkedProductIds)
    refreshLandingPageRoutes(data.slug)
    return { ok: true, message: 'Landing page created.', id: data.id }
  } catch (error) {
    return failure(error)
  }
}

export async function updateLandingPage(id: string, input: LandingPageInput): Promise<LandingPageActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const payload = validateLandingPageInput(input)
    const { linked_product_ids: linkedProductIds = [], ...pagePayload } = payload
    const db = createAdminClient()
    const { data, error } = await db.from('landing_pages').update({ ...pagePayload, published_at: payload.status === 'published' ? new Date().toISOString() : null, updated_by: session.userId, updated_at: new Date().toISOString() }).eq('id', id).select('id,slug').single()
    if (error) throw new Error(error.message.includes('landing_pages_slug_key') ? 'That landing-page slug is already in use.' : 'The landing page could not be updated.')
    await saveLinkedProducts(db, id, linkedProductIds)
    refreshLandingPageRoutes(data.slug)
    return { ok: true, message: 'Landing page updated.', id }
  } catch (error) {
    return failure(error)
  }
}

export async function setLandingPageStatus(id: string, status: 'draft' | 'published' | 'archived'): Promise<LandingPageActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const db = createAdminClient()
    const { data, error } = await db.from('landing_pages').update({ status, published_at: status === 'published' ? new Date().toISOString() : null, updated_by: session.userId, updated_at: new Date().toISOString() }).eq('id', id).select('slug').single()
    if (error) throw new Error('The landing-page status could not be changed.')
    refreshLandingPageRoutes(data.slug)
    return { ok: true, message: status === 'published' ? 'Landing page published.' : `Landing page moved to ${status}.` }
  } catch (error) {
    return failure(error)
  }
}

export async function deleteLandingPage(id: string): Promise<LandingPageActionResult> {
  try {
    await requireAdmin(['OWNER', 'ADMIN'])
    const db = createAdminClient()
    const { error } = await db.from('landing_pages').delete().eq('id', id)
    if (error) throw new Error('The landing page could not be deleted.')
    refreshLandingPageRoutes()
    return { ok: true, message: 'Landing page deleted.' }
  } catch (error) {
    return failure(error)
  }
}
