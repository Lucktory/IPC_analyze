// ============================================================================
// SortedHorizontalBars — one row per category: [label] [bar] [count].
// Pure-HTML implementation (no ECharts) so it adapts to the theme via CSS
// variables and stays crisp at any zoom. Ordering is preserved from the
// data array — pass the data sorted however you want.
// ============================================================================

import { fmtCompactARS } from '../theme'
import { fmtMoney } from '@/lib/format'

type ValueFormat = 'int' | 'money' | 'compact'
const VALUE_FORMATTERS: Record<ValueFormat, (v: number) => string> = {
  int:     v => v.toLocaleString('es-AR'),
  money:   v => fmtMoney(v),
  compact: v => fmtCompactARS(v),
}

export interface SortedBarItem {
  label: string
  value: number
  color: string
}

interface Props {
  items: SortedBarItem[]
  /** Word after the big total (e.g. "contratos"). Empty hides the big total. */
  totalUnit?: string
  /** How the per-row value + big total are formatted. 'int' (default) for
   *  counts, 'money'/'compact' for amounts. A string so it can cross the
   *  server -> client boundary. */
  valueFormat?: ValueFormat
}

export function SortedHorizontalBars({ items, totalUnit = '', valueFormat = 'int' }: Props) {
  const formatValue = VALUE_FORMATTERS[valueFormat]
  const total = items.reduce((s, i) => s + i.value, 0)
  const max   = Math.max(1, ...items.map(i => i.value))

  if (total === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-slate">Sin datos para mostrar</div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {totalUnit && (
        <p className="font-display text-[26px] font-medium text-ink tabular-nums leading-none">
          {formatValue(total)}
          <span className="text-[14px] font-normal text-slate ml-2">{totalUnit}</span>
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {items.map(i => {
          const barWidth = (i.value / max) * 100
          return (
            <li key={i.label} className="grid grid-cols-[minmax(64px,92px)_minmax(0,1fr)_auto] gap-2.5 items-center">
              <span className="text-[13px] text-slate-dark truncate">{i.label}</span>
              <div className="h-2 rounded-full bg-cream-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${barWidth}%`, backgroundColor: i.color }}
                />
              </div>
              <span className="text-[12px] font-medium text-ink tabular-nums text-right whitespace-nowrap">{formatValue(i.value)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
