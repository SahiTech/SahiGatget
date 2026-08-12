import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-4">
        <FileQuestion className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        Page not found
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-600">
        Sorry, we couldn&apos;t find the page you are looking for. It may have been moved or doesn&apos;t exist.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/">Return to Home</Link>
        </Button>
      </div>
    </div>
  )
}
