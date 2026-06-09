// KPI strip layout — desktop grid, mobile swipe-snap horizontal carousel.
//
// This is NOT itself sticky. Two stacked `position: sticky` elements that
// don't know each other's heights produce alignment bugs on mobile (the
// second one slides under the first when the first wraps). Instead this
// strip is meant to be rendered INSIDE <StickyHeader>, so both share a
// single sticky region with a single combined height.

interface KPIStripProps {
  children: React.ReactNode
  cols?:    2 | 3 | 4   // Desktop columns. Default: 4.
}

export function StickyKPIStrip({ children, cols = 4 }: KPIStripProps) {
  const colClass = cols === 2 ? 'sm:grid-cols-2'
                 : cols === 3 ? 'sm:grid-cols-3'
                              : 'sm:grid-cols-4'

  return (
    <div className={[
      'flex sm:grid',
      colClass,
      'gap-2',
      // Mobile horizontal scroll with snap
      'overflow-x-auto sm:overflow-visible',
      'snap-x snap-mandatory sm:snap-none',
      // Hide scrollbar on mobile (the snap makes it discoverable enough)
      '[&::-webkit-scrollbar]:hidden',
      // Small vertical padding so card rings don't get visually clipped at edges
      'pb-1 sm:pb-0',
    ].join(' ')}>
      {children}
    </div>
  )
}

/**
 * Wrap each KPICard with this. Gives it snap+min-width behavior on mobile.
 * On desktop it falls into the grid normally.
 */
export function StickyKPIStripItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="snap-start shrink-0 w-[58%] sm:w-auto">
      {children}
    </div>
  )
}
