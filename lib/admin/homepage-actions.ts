'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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

export async function createHomepageBanner(payload: Omit<HomepageBanner, 'id' | 'created_at' | 'updated_at'>) {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('homepage_banners')
    .insert([{ ...payload, created_by: session.userId }])
    .select()
    .single()

  if (error) throw new Error('Unable to create homepage banner.')
  
  revalidatePath('/')
  revalidatePath('/admin/homepage')
  return data as HomepageBanner
}

export async function updateHomepageBanner(id: string, payload: Partial<HomepageBanner>) {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('homepage_banners')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error('Unable to update homepage banner.')

  revalidatePath('/')
  revalidatePath('/admin/homepage')
  return data as HomepageBanner
}

export async function deleteHomepageBanner(id: string) {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  const supabase = await createClient()

  const { error } = await supabase
    .from('homepage_banners')
    .delete()
    .eq('id', id)

  if (error) throw new Error('Unable to delete homepage banner.')

  revalidatePath('/')
  revalidatePath('/admin/homepage')
  return { success: true }
}

export async function uploadBannerImage(file: File, path: string) {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from('homepage-banners')
    .upload(path, file, { upsert: true })

  if (error) throw new Error('Unable to upload banner image.')

  const { data: { publicUrl } } = supabase.storage
    .from('homepage-banners')
    .getPublicUrl(data.path)

  return publicUrl
}
