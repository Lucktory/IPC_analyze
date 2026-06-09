// Pure-CSS sticky header. The horizontal negative margins + matching padding
// make the cream background span to the edges of the centered content area.
// No scroll detection, no condense logic, no client component — the height
// is fixed, and any feedback-loop bugs from the previous condense-on-scroll
// approach are gone with it.

export function StickyHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 bg-cream/95 backdrop-blur-sm border-b border-line/60">
      {children}
    </div>
  )
}
