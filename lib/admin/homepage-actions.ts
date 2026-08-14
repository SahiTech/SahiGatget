'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin/auth'
import type { HomepageBanner } from '@/lib/services/storefront-utils'

export async function getHomepageBanners() {
  const session = await requireAdmin(['OWNER', 'ADMIN', 'STAFF'])
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('homepage_banners')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw new Error('Unable to load homepage banners.')
  return data as HomepageBanner[]
}

export async function uploadBannerImageAction(formData: FormData) {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file || !file.size) {
      return { success: false, error: 'No valid file provided.' }
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
    if (!allowedTypes.has(file.type) || file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'Use a JPEG, PNG, WebP, or AVIF image up to 5 MB.' }
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
      return { success: false, error: error.message }
    }

    const { data: { publicUrl } } = db.storage
      .from('homepage-banners')
      .getPublicUrl(data.path)

    return { success: true, url: publicUrl }
  } catch (err: any) {
    console.error('Server action upload error:', err)
    return { success: false, error: err.message || 'Server upload failed.' }
  }
}

export async function createHomepageBanner(payload: Omit<HomepageBanner, 'id' | 'created_at' | 'updated_at'>) {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  const db = createAdminClient()

  const { data, error } = await db
    .from('homepage_banners')
    .insert([{ ...payload, created_by: session.userId }])
    .select()
    .single()

  if (error) {
    console.error('Error creating banner:', error)
    throw new Error(`Unable to create homepage banner: ${error.message}`)
  }
  
  revalidatePath('/')
  revalidatePath('/admin/homepage')
  return data as HomepageBanner
}

export async function updateHomepageBanner(id: string, payload: Partial<HomepageBanner>) {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  const db = createAdminClient()

  const { data, error } = await db
    .from('homepage_banners')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating banner:', error)
    throw new Error(`Unable to update homepage banner: ${error.message}`)
  }

  revalidatePath('/')
  revalidatePath('/admin/homepage')
  return data as HomepageBanner
}

export async function deleteHomepageBanner(id: string) {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  const db = createAdminClient()

  const { error } = await db
    .from('homepage_banners')
    .delete()
    .eq('id', id)

  if (error) throw new Error('Unable to delete homepage banner.')

  revalidatePath('/')
  revalidatePath('/admin/homepage')
  return { success: true }
}
