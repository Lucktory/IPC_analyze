// Skeleton shown while the contract detail page fetches its data
// (getContractDetail + getEmbudoForContract + getNoteForPeriod + periods).
// Mirrors the actual layout so the swap-in is visually stable.

export default function ContractDetailLoading() {
  return (
    <div className="animate-pulse" aria-hidden>
      {/* Breadcrumb */}
      <div className="mb-6 h-3 w-32 bg-cream-2 rounded" />

      {/* Hero — name, address line, status badge */}
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="h-2.5 w-16 bg-cream-2 rounded mb-2" />
          <div className="h-7 w-72 bg-cream-2 rounded mb-2" />
          <div className="h-3 w-96 bg-cream-2 rounded" />
        </div>
        <div className="h-5 w-20 bg-cream-2 rounded-full" />
      </div>

      {/* Metadata strip */}
      <section className="bg-paper border border-line rounded shadow-card p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="h-2.5 w-16 bg-cream-2 rounded mb-2" />
              <div className="h-4 w-24 bg-cream-2 rounded" />
            </div>
          ))}
        </div>
      </section>

      {/* Próximo aumento callout */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card p-4">
        <div className="flex items-baseline gap-3">
          <div className="h-2.5 w-24 bg-cream-2 rounded" />
          <div className="h-5 w-32 bg-cream-2 rounded" />
        </div>
      </section>

      {/* Embudo card */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-6 py-5 border-b border-line">
          <div className="h-4 w-48 bg-cream-2 rounded mb-2" />
          <div className="h-3 w-80 bg-cream-2 rounded" />
        </div>
        <div className="px-6 py-6 max-w-2xl mx-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <div className="h-3 w-40 bg-cream-2 rounded" />
              <div className="h-3 w-28 bg-cream-2 rounded" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
