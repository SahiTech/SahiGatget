import type { StorefrontBrand } from '@/lib/services/storefront-utils'

type BrandLogoProps = {
  brand: Pick<StorefrontBrand, 'name' | 'logo_url'>
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-9 w-9 rounded-xl p-1.5',
  md: 'h-16 w-16 rounded-2xl p-2.5',
  lg: 'h-24 w-24 rounded-[1.5rem] p-4',
}

export function BrandLogo({ brand, size = 'md', className = '' }: BrandLogoProps) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-slate-50 ${sizeClasses[size]} ${className}`}>
      {brand.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logo_url} alt={`${brand.name} logo`} className="h-full w-full object-contain" loading="lazy" />
      ) : (
        <span className="text-center text-[9px] font-bold uppercase leading-tight tracking-[0.12em] text-slate-400">Brand logo</span>
      )}
    </div>
  )
}
