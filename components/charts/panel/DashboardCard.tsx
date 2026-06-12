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
  children:  ReactNode
}

export function DashboardCard({
  title,
  subtitle,
  topRight,
  minHeight,
  children,
}: DashboardCardProps) {
  return (
    <section
      className="rounded bg-paper border border-line shadow-card px-5 py-4 sm:px-6 sm:py-5"
      style={minHeight ? { minHeight } : undefined}
    >
      <header className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-medium text-ink leading-tight">{title}</h3>
          {subtitle && (
            <p className="text-[12px] text-slate mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {topRight && <div className="shrink-0">{topRight}</div>}
      </header>
      {children}
    </section>
  )
}
