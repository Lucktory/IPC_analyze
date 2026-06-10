// Skeleton for the landlord detail page (edit form + properties + contracts).
export default function LandlordDetailLoading() {
  return <DetailFormSkeleton />
}

export function DetailFormSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="mb-6 h-3 w-32 bg-cream-2 rounded" />
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="h-2.5 w-20 bg-cream-2 rounded mb-2" />
          <div className="h-7 w-64 bg-cream-2 rounded mb-2" />
          <div className="h-3 w-80 bg-cream-2 rounded" />
        </div>
      </div>

      <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <div className="h-4 w-40 bg-cream-2 rounded mb-2" />
          <div className="h-3 w-72 bg-cream-2 rounded" />
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-2.5 w-20 bg-cream-2 rounded mb-2" />
              <div className="h-10 bg-cream-2 rounded" />
            </div>
          ))}
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <div className="h-9 w-24 bg-cream-2 rounded" />
            <div className="h-9 w-32 bg-cream-2 rounded" />
          </div>
        </div>
      </section>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <div className="h-4 w-32 bg-cream-2 rounded mb-2" />
          <div className="h-3 w-56 bg-cream-2 rounded" />
        </div>
        <div className="divide-y divide-line/30">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-4">
              <div className="h-3 w-40 bg-cream-2 rounded" />
              <div className="h-3 w-32 bg-cream-2 rounded ml-auto" />
              <div className="h-3 w-16 bg-cream-2 rounded" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
