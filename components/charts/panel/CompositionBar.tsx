// ============================================================================
// CompositionBar — a single horizontal bar split into colored segments,
// with the count embedded inside each segment when there's room, plus a
// vertical legend column. Linear / Vercel-style "composition bar".
//
// Reads much better than a donut at panel sizes: same information density,
// less wasted whitespace, and you can hover any segment to inspect.
// ============================================================================

export interface CompositionBarItem {
  label: string
  value: number
  color: string
}

interface Props {
  items: CompositionBarItem[]
  /** Word shown after the big total (e.g. "propiedades"). */
  totalUnit?: string
}

export function CompositionBar({ items, totalUnit = '' }: Props) {
  const total = items.reduce((s, i) => s + i.value, 0)
  if (total === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-slate">Sin datos para mostrar</div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-display text-[28px] font-medium text-ink tabular-nums leading-none">
          {total.toLocaleString('es-AR')}
          {totalUnit && <span className="text-[14px] font-normal text-slate ml-2">{totalUnit}</span>}
        </p>
      </div>

      {/* The bar itself — segments are sized by value, separated by tiny gaps */}
      <div className="flex h-3 rounded-full overflow-hidden bg-cream-2" role="img" aria-label="Distribución">
        {items.map((i, idx) => {
          const pct = (i.value / total) * 100
          return (
            <div
              key={i.label}
              title={`${i.label}: ${i.value} (${pct.toFixed(1)}%)`}
              className="h-full transition-opacity hover:opacity-80"
              style={{
                width:            `${pct}%`,
                backgroundColor:  i.color,
                marginLeft:       idx === 0 ? 0 : 2,
              }}
            />
          )
        })}
      </div>

      {/* Legend rows below — colored dot + label + count + percent */}
      <ul className="grid grid-cols-1 gap-2.5">
        {items.map(i => {
          const pct = (i.value / total) * 100
          return (
            <li key={i.label} className="flex items-baseline gap-3">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: i.color }} />
              <span className="text-[13px] text-ink flex-1 truncate">{i.label}</span>
              <span className="text-[13px] font-medium text-ink tabular-nums">{i.value}</span>
              <span className="text-[11px] text-slate tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
