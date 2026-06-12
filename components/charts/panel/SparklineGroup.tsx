'use client'

// ============================================================================
// SparklineGroup — N stacked small-multiples. Each row is wrapped in a
// tinted card (background tint = series color at low opacity) so the row
// reads as a self-contained module, matching the "tint card" design
// language used elsewhere on /dashboard.
//
// Animation: each line draws in from left to right via stroke-dashoffset.
// Staggered start so the rows reveal sequentially (200ms apart).
// ============================================================================

import { useEffect, useId, useState } from 'react'

export interface SparklineSeries {
  label:     string
  color:     string
  /** Current period (last value) formatted for display. */
  current:   string
  /** Optional % change vs the first point. null hides it. */
  changePct: number | null
  values:    number[]
}

interface Props {
  series:    SparklineSeries[]
  xLabels?:  string[]
  height?:   number
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)}, ${alpha})`
}

export function SparklineGroup({ series, xLabels, height = 240 }: Props) {
  const rowHeight = (height - 10 * (series.length - 1)) / series.length
  return (
    <div className="flex flex-col gap-2.5">
      {series.map((s, i) => (
        <SparklineRow key={s.label} series={s} xLabels={xLabels} height={rowHeight} delayMs={i * 180} />
      ))}
    </div>
  )
}

function SparklineRow({
  series,
  xLabels,
  height,
  delayMs,
}: {
  series:  SparklineSeries
  xLabels?: string[]
  height:  number
  delayMs: number
}) {
  const id     = useId().replace(/:/g, '')
  const values = series.values
  const max    = Math.max(...values)
  const min    = Math.min(...values)
  const range  = max - min || 1

  const VBW = 400
  // header takes ~32px, optional xLabels row takes ~14px
  const VBH = Math.max(24, height - 38 - (xLabels ? 14 : 0))

  const step = values.length > 1 ? VBW / (values.length - 1) : 0
  const points = values.map((v, i) => {
    const x = i * step
    const y = VBH - 4 - ((v - min) / range) * (VBH - 8)
    return [x, y] as const
  })

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${VBW} ${VBH} L 0 ${VBH} Z`

  const last = points.at(-1)
  const changeColor =
    series.changePct == null   ? 'text-slate'
      : series.changePct > 0   ? 'text-success'
      : series.changePct < 0   ? 'text-danger'
      :                          'text-slate'
  const changeSign  = series.changePct == null ? '' : series.changePct > 0 ? '↑' : series.changePct < 0 ? '↓' : '·'

  // Animate: stroke-dashoffset slides from 1 → 0 to "draw" the line.
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setDrawn(true))
    })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [])

  return (
    <div
      className="rounded-md px-3 py-2.5 border-l-[3px] transition-all"
      style={{
        borderLeftColor: series.color,
        backgroundColor: hexToRgba(series.color, 0.07),
      }}
    >
      <div className="flex items-baseline gap-3 mb-1.5">
        <span
          className="text-[10px] uppercase tracking-wider font-semibold flex-1 truncate"
          style={{ color: series.color }}
        >
          {series.label}
        </span>
        <span className="text-[15px] font-medium text-ink tabular-nums">{series.current}</span>
        {series.changePct != null && (
          <span
            className={`text-[10px] tabular-nums font-medium px-1.5 py-0.5 rounded-full ${changeColor}`}
            style={{ backgroundColor: hexToRgba(series.color, 0.10) }}
          >
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
            <stop offset="0%"   stopColor={series.color} stopOpacity="0.40" />
            <stop offset="100%" stopColor={series.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill — fades in (no path draw since fills don't animate cleanly) */}
        <path
          d={areaPath}
          fill={`url(#grad-${id})`}
          opacity={drawn ? 1 : 0}
          style={{ transition: `opacity 0.8s ease-out ${delayMs + 200}ms` }}
        />
        {/* Line stroke — draws in via stroke-dashoffset */}
        <path
          d={linePath}
          fill="none"
          stroke={series.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset={drawn ? 0 : 1}
          style={{ transition: `stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms` }}
        />
        {last && (
          <circle
            cx={last[0]}
            cy={last[1]}
            r="3"
            fill={series.color}
            vectorEffect="non-scaling-stroke"
            opacity={drawn ? 1 : 0}
            style={{ transition: `opacity 0.3s ease-out ${delayMs + 1100}ms` }}
          />
        )}
      </svg>
      {xLabels && xLabels.length > 0 && (
        <div className="flex justify-between mt-0.5 text-[9px] text-slate tabular-nums">
          <span>{xLabels[0]}</span>
          <span>{xLabels.at(-1)}</span>
        </div>
      )}
    </div>
  )
}
