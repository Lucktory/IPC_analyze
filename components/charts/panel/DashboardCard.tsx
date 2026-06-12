// ============================================================================
// DashboardCard — dark "executive" card wrapper used across the /dashboard
// premium panels (donuts, monthly bars, multi-line area).
//
// Design language: near-black surface, slate-cool border, large display
// title + small caption, optional top-right slot for a delta indicator
// ("vs. mes anterior ↑14") or auxiliary KPIs.
// ============================================================================

import type { ReactNode } from 'react'

interface DashboardCardProps {
  title:     string
  subtitle?: string
  /** Top-right slot: delta indicator, series KPIs, etc. */
  topRight?: ReactNode
  /** Optional fixed height — useful when sibling cards must align. */
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
      className="rounded-xl border border-panel-line bg-panel-surface px-6 py-5 shadow-lg shadow-black/30"
      style={minHeight ? { minHeight } : undefined}
    >
      <header className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-medium text-panel-ink leading-tight">{title}</h3>
          {subtitle && (
            <p className="text-[12px] text-panel-muted mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {topRight && <div className="shrink-0">{topRight}</div>}
      </header>
      {children}
    </section>
  )
}
