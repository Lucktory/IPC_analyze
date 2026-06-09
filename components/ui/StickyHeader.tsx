// Sticky page header — keeps the period info + KPI row visible while the
// list/table below scrolls. The horizontal negative margins + matching padding
// make the cream background span to the edges of the centered content area
// (so the watermark behind doesn't show through during scroll).

export function StickyHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-5 pb-4 mb-2 bg-cream/95 backdrop-blur-sm border-b border-line/60">
      {children}
    </div>
  )
}
