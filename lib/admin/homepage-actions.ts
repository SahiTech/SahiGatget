'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin/auth'
import type { HomepageBanner } from '@/lib/services/storefront-utils'

export type AdminActionResult = { ok: boolean; message: string }

function actionFailure(error: unknown): AdminActionResult {
  if (error instanceof Error) {
    if (error.message === 'ADMIN_FORBIDDEN') return { ok: false, message: 'You do not have permission for this operation.' }
    return { ok: false, message: error.message || 'The operation could not be completed.' }
  }
  return { ok: false, message: 'The operation could not be completed.' }
}

function refreshAdminRoutes() {
  revalidatePath('/admin/homepage')
  revalidatePath('/')
}

export async function getHomepageBanners() {
  await requireAdmin(['OWNER', 'ADMIN', 'STAFF'])
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('homepage_banners')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw new Error('Unable to load homepage banners.')
  return data as HomepageBanner[]
}

export async function uploadBannerImageAction(formData: FormData): Promise<AdminActionResult & { url?: string }> {
  try {
    await requireAdmin(['OWNER', 'ADMIN'])
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file || !file.size) {
      return { ok: false, message: 'No valid file provided.' }
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
    if (!allowedTypes.has(file.type) || file.size > 5 * 1024 * 1024) {
      return { ok: false, message: 'Use a JPEG, PNG, WebP, or AVIF image up to 5 MB.' }
    }

    const db = createAdminClient()
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1] || 'jpg'
    const filename = `banners/${type}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { data, error } = await db.storage
      .from('homepage-banners')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('Storage upload action error:', error)
      return { ok: false, message: error.message }
    }

    const { data: { publicUrl } } = db.storage
      .from('homepage-banners')
      .getPublicUrl(data.path)

    return { ok: true, message: 'Image uploaded successfully.', url: publicUrl }
  } catch (error: unknown) {
    console.error('Server action upload error:', error)
    return { ok: false, message: error instanceof Error ? error.message : 'Server upload failed.' }
  }
}

export async function createHomepageBanner(payload: Omit<HomepageBanner, 'id' | 'created_at' | 'updated_at'>): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const db = createAdminClient()

    const { error } = await db
      .from('homepage_banners')
      .insert([{ ...payload, created_by: session.userId }])

    if (error) throw new Error(error.message)
    
    refreshAdminRoutes()
    return { ok: true, message: 'Homepage banner created successfully.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function updateHomepageBanner(id: string, payload: Partial<HomepageBanner>): Promise<AdminActionResult> {
  try {
    await requireAdmin(['OWNER', 'ADMIN'])
    const db = createAdminClient()

    const { error } = await db
      .from('homepage_banners')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw new Error(error.message)

    refreshAdminRoutes()
    return { ok: true, message: 'Homepage banner updated successfully.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function deleteHomepageBanner(id: string): Promise<AdminActionResult> {
  try {
    await requireAdmin(['OWNER', 'ADMIN'])
    const db = createAdminClient()

    const { error } = await db
      .from('homepage_banners')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)

    refreshAdminRoutes()
    return { ok: true, message: 'Homepage banner deleted successfully.' }
  } catch (error) {
    return actionFailure(error)
  }
}
