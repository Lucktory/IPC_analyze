// ============================================================================
// SortedHorizontalBars — one row per category: [label] [bar] [count].
// Pure-HTML implementation (no ECharts) so it adapts to the theme via CSS
// variables and stays crisp at any zoom. Ordering is preserved from the
// data array — pass the data sorted however you want.
// ============================================================================

export interface SortedBarItem {
  label: string
  value: number
  color: string
}

interface Props {
  items: SortedBarItem[]
  /** Word after the big total (e.g. "contratos"). */
  totalUnit?: string
}

export function SortedHorizontalBars({ items, totalUnit = '' }: Props) {
  const total = items.reduce((s, i) => s + i.value, 0)
  const max   = Math.max(1, ...items.map(i => i.value))

  if (total === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-slate">Sin datos para mostrar</div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-[28px] font-medium text-ink tabular-nums leading-none">
        {total.toLocaleString('es-AR')}
        {totalUnit && <span className="text-[14px] font-normal text-slate ml-2">{totalUnit}</span>}
      </p>

      <ul className="flex flex-col gap-3">
        {items.map(i => {
          const pct      = (i.value / total) * 100
          const barWidth = (i.value / max)   * 100
          return (
            <li key={i.label} className="grid grid-cols-[88px_minmax(0,1fr)_44px_36px] gap-3 items-center">
              <span className="text-[13px] text-slate-dark truncate">{i.label}</span>
              <div className="h-2 rounded-full bg-cream-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${barWidth}%`, backgroundColor: i.color }}
                />
              </div>
              <span className="text-[13px] font-medium text-ink tabular-nums text-right">{i.value}</span>
              <span className="text-[11px] text-slate tabular-nums text-right">{pct.toFixed(0)}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
