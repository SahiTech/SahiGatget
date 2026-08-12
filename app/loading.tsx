export default function Loading() {
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <p className="text-sm font-medium text-gray-600">Loading SahiGadget...</p>
      </div>
    </div>
  )
}
