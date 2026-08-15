type SkeletonProps = { className?: string }

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-slate-200/80 motion-reduce:animate-none ${className}`} />
}

export function StorefrontLoadingShell() {
  return (
    <main className="flex min-h-[70vh] flex-1 items-center justify-center bg-slate-50 px-4 py-16" aria-busy="true" aria-live="polite" aria-label="Loading SahiGadget">
      <div className="w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 shadow-lg shadow-slate-900/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="SahiGadget" width="56" height="56" className="h-full w-full object-cover" />
        </div>
        <p className="mt-5 text-lg font-black tracking-tight text-slate-950">SahiGadget</p>
        <div className="mx-auto mt-4 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          <div className="h-full w-1/2 animate-[loading-progress_1.4s_ease-in-out_infinite] rounded-full bg-emerald-500 motion-reduce:animate-none" />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-500">Preparing your shopping experience…</p>
      </div>
    </main>
  )
}

export function LoadingIntro({ eyebrow = 'Loading catalogue', titleWidth = 'w-72', description = true }: { eyebrow?: string; titleWidth?: string; description?: boolean }) {
  return (
    <div className="border-b border-slate-200 bg-white" aria-hidden="true">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <span className="sr-only">{eyebrow}</span><Skeleton className="h-3 w-32 rounded-full" />
        <Skeleton className={`mt-5 h-11 ${titleWidth} max-w-full rounded-xl`} />
        {description ? <Skeleton className="mt-4 h-5 w-full max-w-2xl rounded-lg bg-slate-100" /> : null}
      </div>
    </div>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-3" aria-hidden="true">
      <Skeleton className="aspect-[4/3] rounded-[1.25rem] bg-slate-100" />
      <Skeleton className="mt-5 h-4 w-24 rounded" />
      <Skeleton className="mt-3 h-6 w-4/5 rounded" />
      <Skeleton className="mt-2 h-4 w-2/5 rounded bg-slate-100" />
      <Skeleton className="mt-7 h-5 w-1/2 rounded" />
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">{Array.from({ length: count }, (_, index) => <ProductCardSkeleton key={index} />)}</div>
}

export function DiscoveryCardSkeleton({ dark = false }: { dark?: boolean }) {
  return <div aria-hidden="true" className={`overflow-hidden rounded-[1.5rem] p-3 ${dark ? 'bg-white/10' : 'border border-slate-200 bg-white shadow-sm'}`}><Skeleton className={`h-40 rounded-[1.25rem] ${dark ? 'bg-white/10' : 'bg-slate-100'}`} /><Skeleton className={`mt-4 h-5 w-2/3 ${dark ? 'bg-white/10' : ''}`} /><Skeleton className={`mt-2 h-4 w-full ${dark ? 'bg-white/10' : 'bg-slate-100'}`} /></div>
}

export function BrandPageSkeleton() {
  return <main className="flex-1" aria-busy="true" aria-label="Loading brands"><LoadingIntro eyebrow="Loading brands" titleWidth="w-64" description={false} /><div className="mx-auto grid max-w-7xl gap-5 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">{Array.from({ length: 8 }, (_, index) => <DiscoveryCardSkeleton key={index} />)}</div></main>
}

export function BrandDetailSkeleton() {
  return <main className="flex-1" aria-busy="true" aria-label="Loading brand catalogue"><div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><Skeleton className="h-24 w-24 shrink-0 rounded-[1.5rem]" /><div className="w-full"><Skeleton className="h-3 w-32 rounded-full" /><Skeleton className="mt-4 h-10 w-72 max-w-full rounded-xl" /><Skeleton className="mt-3 h-5 w-full max-w-2xl rounded bg-slate-100" /></div></div></div><div className="mt-12"><Skeleton className="h-3 w-36 rounded-full" /><Skeleton className="mt-4 h-9 w-80 max-w-full rounded-xl" /><div className="mt-8"><ProductGridSkeleton count={8} /></div></div></div></main>
}

export function CategoryPageSkeleton() {
  return <main className="flex-1" aria-busy="true" aria-label="Loading categories"><LoadingIntro eyebrow="Loading categories" titleWidth="w-72" description={false} /><div className="mx-auto grid max-w-7xl gap-5 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">{Array.from({ length: 6 }, (_, index) => <DiscoveryCardSkeleton key={index} dark />)}</div></main>
}

export function ProductListingSkeleton({ search = false }: { search?: boolean }) {
  return <main className="flex-1" aria-busy="true" aria-label={search ? 'Loading search results' : 'Loading products'}><LoadingIntro eyebrow={search ? 'Loading results' : 'Loading catalogue'} titleWidth={search ? 'w-72' : 'w-80'} /><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{search ? <Skeleton className="mx-auto mb-8 h-14 max-w-3xl rounded-[1.5rem] bg-white ring-1 ring-slate-200" /> : <div className="mb-8 flex gap-3"><Skeleton className="h-11 w-32 rounded-xl" /><Skeleton className="h-11 w-36 rounded-xl" /></div>}<ProductGridSkeleton /></div></main>
}

export function ProductDetailSkeleton() {
  return <main className="flex-1" aria-busy="true" aria-label="Loading product details"><div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8"><Skeleton className="h-4 w-56 rounded" /><div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)] lg:gap-16"><div className="min-w-0"><Skeleton className="aspect-square rounded-[2rem] bg-slate-100" /><div className="mt-4 flex gap-3"><Skeleton className="h-20 w-20 shrink-0 rounded-2xl" /><Skeleton className="h-20 w-20 shrink-0 rounded-2xl" /><Skeleton className="h-20 w-20 shrink-0 rounded-2xl" /></div></div><div><Skeleton className="h-4 w-40 rounded" /><Skeleton className="mt-5 h-12 w-4/5 max-w-xl rounded-xl" /><Skeleton className="mt-5 h-5 w-full max-w-2xl rounded" /><Skeleton className="mt-2 h-5 w-4/5 max-w-xl rounded bg-slate-100" /><Skeleton className="mt-8 h-10 w-44 rounded" /><Skeleton className="mt-8 h-28 w-full rounded-[1.5rem] bg-slate-100" /><Skeleton className="mt-6 h-14 w-full max-w-xs rounded-full" /></div></div><div className="mt-12 grid gap-4 sm:grid-cols-3"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /></div></div></main>
}
