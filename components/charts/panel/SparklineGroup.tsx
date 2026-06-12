'use client'

// ============================================================================
// SparklineGroup — N stacked small-multiples. Each row has:
//   ● label   current-value   trend %
//   sparkline (its own y-scale)
//
// Why this instead of one shared-axis multi-line chart?
//   The dashboard's three series — ingresos (millions of pesos), comisiones
//   (hundreds of thousands), pagos (a dozen tx count) — have wildly different
//   scales. Stacking them on a shared axis flattens the smaller series to a
//   straight line. Each sparkline getting its own scale gives every metric
//   room to show its shape.
//
// Renders as SVG (no ECharts) — fast, sharp at any size, no flash on theme
// swap.
// ============================================================================

import { useId } from 'react'

export interface SparklineSeries {
  label:   string
  color:   string
  /** Current period (last value) formatted for display. */
  current: string
  /** Optional % change vs the first point. Set null to hide. */
  changePct: number | null
  values:  number[]
}

interface Props {
  series:    SparklineSeries[]
  xLabels?:  string[]
  /** Total height — split across rows. Default 230. */
  height?:   number
}

export function SparklineGroup({ series, xLabels, height = 230 }: Props) {
  const rowHeight = (height - 8 * (series.length - 1)) / series.length
  return (
    <div className="flex flex-col gap-2">
      {series.map(s => (
        <SparklineRow key={s.label} series={s} xLabels={xLabels} height={rowHeight} />
      ))}
    </div>
  )
}

function SparklineRow({
  series,
  xLabels,
  height,
}: {
  series:  SparklineSeries
  xLabels?: string[]
  height:  number
}) {
  const id     = useId().replace(/:/g, '')
  const values = series.values
  const max    = Math.max(...values)
  const min    = Math.min(...values)
  const range  = max - min || 1

  // SVG viewBox — fixed width, height scales. Use a generous viewBox so the
  // path geometry computes consistently regardless of container width.
  const VBW = 400
  const VBH = Math.max(20, height - 28)   // reserve 28px for header row

  const step = values.length > 1 ? VBW / (values.length - 1) : 0
  const points = values.map((v, i) => {
    const x = i * step
    // y goes inverted in SVG. Pad 3px top/bottom so the line doesn't touch edges.
    const y = VBH - 3 - ((v - min) / range) * (VBH - 6)
    return [x, y] as const
  })

  // Path strings for line + filled area beneath.
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${VBW} ${VBH} L 0 ${VBH} Z`

  const last = points.at(-1)
  const changeColor =
    series.changePct == null   ? 'text-slate'
      : series.changePct > 0   ? 'text-success'
      : series.changePct < 0   ? 'text-danger'
      :                          'text-slate'
  const changeSign  = series.changePct == null ? '' : series.changePct > 0 ? '↑' : series.changePct < 0 ? '↓' : '·'

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: series.color }} />
        <span className="text-[10px] uppercase tracking-wider text-slate flex-1">{series.label}</span>
        <span className="text-[14px] font-medium text-ink tabular-nums">{series.current}</span>
        {series.changePct != null && (
          <span className={`text-[11px] tabular-nums w-12 text-right ${changeColor}`}>
            {changeSign} {Math.abs(series.changePct).toFixed(0)}%
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height: VBH }}
        role="img"
        aria-label={`Tendencia de ${series.label}`}
      >
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={series.color} stopOpacity="0.30" />
            <stop offset="100%" stopColor={series.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#grad-${id})`} />
        <path d={linePath} fill="none" stroke={series.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {last && (
          <circle cx={last[0]} cy={last[1]} r="2.5" fill={series.color} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {xLabels && xLabels.length > 0 && (
        <div className="flex justify-between mt-1 text-[10px] text-slate tabular-nums">
          <span>{xLabels[0]}</span>
          <span>{xLabels.at(-1)}</span>
        </div>
      )}
    </div>
  )
}
