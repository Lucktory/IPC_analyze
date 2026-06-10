export default function PendingLoading() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 bg-cream/95 backdrop-blur-sm border-b border-line/60">
        <div className="flex items-baseline justify-between mb-3">
          <div className="h-4 w-56 bg-cream-2 rounded" />
          <div className="h-3 w-20 bg-cream-2 rounded" />
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 w-32 bg-cream-2 rounded-full" />
          ))}
        </div>
      </div>

      <section className="mt-4 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <div className="h-4 w-32 bg-cream-2 rounded mb-2" />
          <div className="h-3 w-72 bg-cream-2 rounded" />
        </div>
        <div className="divide-y divide-line/30">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-4">
              <div className="h-3 w-32 bg-cream-2 rounded" />
              <div className="h-3 w-40 bg-cream-2 rounded" />
              <div className="h-3 w-32 bg-cream-2 rounded ml-auto" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
