import { redirect } from 'next/navigation'

import { AdminShell } from '@/components/admin/admin-shell'
import { getAdminSession } from '@/lib/admin/auth'

export default async function AdminOperationsLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  return <AdminShell session={session}>{children}</AdminShell>
}
