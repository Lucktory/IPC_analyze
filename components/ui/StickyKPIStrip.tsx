// Sticky KPI strip — sits BELOW the StickyHeader (title + search). On phones
// it's a swipe-snap horizontal carousel so the cards stay compact; on tablets
// and up it's a 4-column grid (or 3 / 2 if the page has fewer KPIs).
//
// The whole strip is `position: sticky; top` matching the title bar's height,
// so as the user scrolls down both bars remain pinned. No JS, no scroll
// listener, no condense/expand state machine — fixed height, no flicker.

interface StickyKPIStripProps {
  children: React.ReactNode
  cols?:    2 | 3 | 4   // Desktop grid columns. Default: 4.
}

export function StickyKPIStrip({ children, cols = 4 }: StickyKPIStripProps) {
  const colClass = cols === 2 ? 'sm:grid-cols-2'
                 : cols === 3 ? 'sm:grid-cols-3'
                              : 'sm:grid-cols-4'

  return (
    <div className="sticky top-[42px] sm:top-[44px] z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-cream/95 backdrop-blur-sm border-b border-line/60">
      {/* Mobile: horizontal-scroll snap carousel.
          Desktop: grid. Same children. */}
      <div className={[
        // Layout
        'flex sm:grid',
        colClass,
        'gap-2',
        // Mobile-only horizontal-scroll behavior
        'overflow-x-auto sm:overflow-visible',
        'snap-x snap-mandatory sm:snap-none',
        // Bleed slightly off the page edges on mobile so the snap feels right
        '-mx-1 px-1 sm:mx-0 sm:px-0',
        // Hide the ugly horizontal scrollbar on mobile (Webkit only)
        '[&::-webkit-scrollbar]:hidden',
      ].join(' ')}>
        {children}
      </div>
    </div>
  )
}

/**
 * Wrap each KPICard at the call site with <StickyKPIStripItem> so it gets
 * the snap + flex-shrink-0 + width behavior on mobile. On desktop they just
 * fall into the grid normally.
 */
export function StickyKPIStripItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="snap-start shrink-0 w-[60%] sm:w-auto">
      {children}
    </div>
  )
}
