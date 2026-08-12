import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Layers } from 'lucide-react'

export default function Page() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
          </Button>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            Foundation Route
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-4">
            <Layers className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Admin Login
          </h1>
          <p className="mt-2 text-slate-600 max-w-lg mx-auto text-sm">
            Secure Supabase authentication gateway for owners, admins, and staff.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href="/">Return to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
