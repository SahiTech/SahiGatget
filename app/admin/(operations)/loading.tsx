export default function AdminLoading() {
  return <div className="space-y-6" aria-label="Loading administration data"><div className="h-24 animate-pulse rounded-2xl bg-slate-200" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200" />)}</div><div className="h-96 animate-pulse rounded-2xl bg-slate-200" /></div>
}
