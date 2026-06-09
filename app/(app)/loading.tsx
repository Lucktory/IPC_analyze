// Shared skeleton for every page under (app). Renders instantly while the
// Supabase fetches resolve — turns a 600ms blank wait into "structure
// appears immediately, fills in." Mirrors the typical page layout: sticky
// header with KPI strip + a card with a tabular body.

export default function AppLoading() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      {/* Title + KPI strip */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-5 pb-4 mb-2 bg-cream/95 backdrop-blur-sm border-b border-line/60">
        <div className="flex items-baseline justify-between mb-4">
          <div className="h-4 w-48 rounded bg-cream-2" />
          <div className="h-3 w-24 rounded bg-cream-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-paper border border-line rounded shadow-card p-4">
              <div className="h-2.5 w-20 rounded bg-cream-2 mb-3" />
              <div className="h-6 w-28 rounded bg-cream-2 mb-2" />
              <div className="h-2.5 w-32 rounded bg-cream-2" />
            </div>
          ))}
        </div>
      </div>

      {/* Body card with skeleton table */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <div className="h-4 w-32 rounded bg-cream-2 mb-2" />
            <div className="h-2.5 w-56 rounded bg-cream-2" />
          </div>
          <div className="h-3 w-20 rounded bg-cream-2" />
        </div>
        <div className="divide-y divide-line/30">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-4">
              <div className="h-3 w-40 rounded bg-cream-2" />
              <div className="h-3 w-32 rounded bg-cream-2" />
              <div className="h-3 w-24 rounded bg-cream-2 ml-auto" />
              <div className="h-3 w-16 rounded bg-cream-2" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
