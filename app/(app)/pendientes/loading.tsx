// Skeleton for the new /pendientes layout (Phase 8). Matches the actual
// page shape (severity KPI strip + type filter row + accordion sections)
// so users don't briefly see the OLD layout while the server component
// renders.

export default function PendingLoading() {
  return (
    <div className="animate-pulse" aria-hidden>
      {/* Header line */}
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="h-4 w-64 bg-cream-2 rounded" />
      </div>

      {/* Severity KPI strip — 4 tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 bg-cream-2 rounded border border-line/60" />
        ))}
      </div>

      {/* Type filter pills */}
      <div className="flex items-center gap-2 pb-2 flex-wrap">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-5 w-20 bg-cream-2 rounded-full" />
        ))}
      </div>

      {/* Accordion sections — 3 placeholders */}
      <div className="space-y-4 mt-2">
        {Array.from({ length: 3 }).map((_, s) => (
          <div key={s} className="bg-paper border border-line rounded overflow-hidden">
            <div className="px-4 py-2 border-b border-line bg-cream/40 flex items-center justify-between">
              <div className="h-3 w-48 bg-cream-2 rounded" />
              <div className="h-2 w-12 bg-cream-2 rounded" />
            </div>
            <div className="divide-y divide-line/30">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="h-3 w-32 bg-cream-2 rounded" />
                  <div className="h-3 w-48 bg-cream-2 rounded" />
                  <div className="h-3 w-20 bg-cream-2 rounded ml-auto" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
