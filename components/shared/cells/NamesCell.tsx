// ============================================================================
// NamesCell — stacked names inside a single table cell.
//
// Per the saved memory `ui_multi_name_cell_display.md`: whenever a row's
// cell contains N people of one kind (owners, tenants, …), each name
// renders on its OWN line within the cell, with their percentage on the
// right. Never comma-separated, never truncated, never tooltip-hidden.
//
// Empty list renders a muted "—". A small label-cap on top shows the
// count so the encargada can scan how many at a glance.
// ============================================================================

import type { ReactNode } from 'react'

export interface NamesCellItem {
  /** Stable React key. Doesn't have to be a database UUID. */
  id:   string
  name: string
  /** Percentage shown next to the name. */
  pct:  number
}

interface Props {
  items:        NamesCellItem[]
  /**
   * Singular/plural noun shown above the names list, e.g. "propietario" /
   * "propietarios" or "inquilino" / "inquilinos". Pass as a tuple.
   * Defaults to "persona" / "personas".
   */
  noun?:        [singular: string, plural: string]
  /** Renders when `items` is empty. Defaults to a muted em-dash. */
  emptyFallback?: ReactNode
}

export function NamesCell({
  items,
  noun           = ['persona', 'personas'],
  emptyFallback  = <span className="text-slate/50">—</span>,
}: Props) {
  if (items.length === 0) return <>{emptyFallback}</>

  const [singular, plural] = noun
  const label = items.length === 1 ? singular : plural

  return (
    <div>
      <p className="text-[10px] text-slate font-medium tracking-wider uppercase mb-0.5">
        {items.length} {label}
      </p>
      {items.map(it => (
        <div key={it.id} className="flex items-baseline justify-between gap-2">
          <span className="text-ink leading-snug">{it.name}</span>
          <span className="text-[10px] text-slate tabular-nums shrink-0">
            {it.pct.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  )
}
