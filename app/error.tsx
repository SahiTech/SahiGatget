'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Application Error:', error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        Something went wrong!
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-600">
        We encountered an unexpected error. Our engineering team has been notified. Please try again.
      </p>
      <div className="mt-6 flex gap-4">
        <Button onClick={() => reset()} variant="default">
          Try again
        </Button>
        <Button onClick={() => router.push('/')} variant="outline">
          Go back home
        </Button>
      </div>
    </div>
  )
}
