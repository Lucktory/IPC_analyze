// ============================================================================
// DashboardCard — light "executive" card used across the /dashboard premium
// panels. Matches the rest of the app's bg-paper / border-line / shadow-card
// look. The "premium" feel comes from the chart palette + layout, not theme.
// ============================================================================

import type { ReactNode } from 'react'

interface DashboardCardProps {
  title:     string
  subtitle?: string
  /** Top-right slot: delta indicator, series KPIs, etc. */
  topRight?: ReactNode
  /** Optional minimum height — useful when sibling cards must align. */
  minHeight?: number
  /** Fill the parent's height: the card becomes a flex column and the body
   *  gets `flex-1 min-h-0` so a chart inside can grow/shrink with the
   *  viewport (used by the one-screen /dashboard grid). */
  fill?:     boolean
  /** Extra classes appended to the wrapping <section>. Used for grid spans. */
  className?: string
  children:  ReactNode
}

export function DashboardCard({
  title,
  subtitle,
  topRight,
  minHeight,
  fill = false,
  className = '',
  children,
}: DashboardCardProps) {
  return (
    <section
      className={`rounded bg-paper border border-line shadow-card px-4 py-3 sm:px-5 sm:py-3.5 ${fill ? 'lg:h-full lg:flex lg:flex-col lg:min-h-0 lg:overflow-hidden' : ''} ${className}`}
      style={minHeight ? { minHeight } : undefined}
    >
      <header className={`flex items-start justify-between gap-4 mb-2.5 ${fill ? 'lg:shrink-0' : ''}`}>
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-medium text-ink leading-tight">{title}</h3>
          {subtitle && (
            <p className="text-[12px] text-slate mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {topRight && <div className="shrink-0">{topRight}</div>}
      </header>
      {fill ? <div className="lg:flex-1 lg:min-h-0">{children}</div> : children}
    </section>
  )
}
