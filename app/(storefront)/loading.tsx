import { ProductGridSkeleton, Skeleton } from '@/components/storefront/loading-skeletons'

export default function StorefrontLoading() {
  return (
    <main className="flex-1 bg-slate-50/50" aria-busy="true" aria-label="Loading SahiGadget storefront">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="aspect-[16/8] min-h-56 rounded-[2rem] bg-slate-200/70 sm:min-h-72" />
      </section>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <Skeleton className="h-3 w-28 rounded-full" />
        <Skeleton className="mt-4 h-9 w-64 max-w-full rounded-xl" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-48 rounded-[1.5rem]" /><Skeleton className="h-48 rounded-[1.5rem]" /><Skeleton className="h-48 rounded-[1.5rem]" /></div>
      </section>
      <section className="border-y border-slate-200 bg-white py-14"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><Skeleton className="h-3 w-36 rounded-full" /><Skeleton className="mt-4 h-9 w-80 max-w-full rounded-xl" /><div className="mt-8"><ProductGridSkeleton count={4} /></div></div></section>
    </main>
  )
}
