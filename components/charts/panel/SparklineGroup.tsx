'use client'

// ============================================================================
// SparklineGroup — N stacked small-multiples. Each row is a tinted card
// (background tint = series color at low opacity) with:
//   - header: label + current value + change pill
//   - sparkline: stroke-dashoffset draw-in animation, with two inline
//                annotations rendered as positioned HTML overlays:
//                  * peak month value (when peak ≠ current month)
//                  * current month value (next to the end dot)
//
// Labels are HTML (not <text> in SVG) because the SVG uses
// preserveAspectRatio="none" which would horizontally stretch text glyphs.
// HTML labels stay crisp at any container width.
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
  /**
   * Optional formatter for the inline peak + current labels. Defaults
   * to `v.toLocaleString('es-AR')`. Use `fmtCompactARS` for money,
   * `v => v.toFixed(1) + '%'` for percentages, etc.
   */
  formatValue?: (v: number) => string
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

export function SparklineGroup({ series, xLabels, height = 280 }: Props) {
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

  const VBW     = 400
  // header takes ~36px (label row + margin), optional xLabels row takes ~14px
  const VBH     = Math.max(36, height - 40 - (xLabels ? 14 : 0))
  const TOP_PAD = 14   // leave room for the inline value labels above the peak
  const BOT_PAD = 5
  const chartH  = Math.max(8, VBH - TOP_PAD - BOT_PAD)

  const step = values.length > 1 ? VBW / (values.length - 1) : 0
  const points = values.map((v, i) => {
    const x = i * step
    const y = VBH - BOT_PAD - ((v - min) / range) * chartH
    return [x, y] as const
  })

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${VBW} ${VBH} L 0 ${VBH} Z`

  const last         = points.at(-1)
  const currentValue = values.at(-1) ?? 0
  const peakIdx      = values.indexOf(max)
  const peakAtEnd    = peakIdx === values.length - 1
  // Peak label only when there's a meaningful spread (range>0), peak is not
  // the current month, and peak > 0 (avoids labeling a flatline at zero).
  const showPeak     = max > 0 && !peakAtEnd && range > 0
  const peakPt       = showPeak ? points[peakIdx] : null
  const fmt          = series.formatValue ?? ((v: number) => v.toLocaleString('es-AR'))

  const changeColor =
    series.changePct == null   ? 'text-slate'
      : series.changePct > 0   ? 'text-success'
      : series.changePct < 0   ? 'text-danger'
      :                          'text-slate'
  const changeSign  = series.changePct == null ? '' : series.changePct > 0 ? '↑' : series.changePct < 0 ? '↓' : '·'

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

      {/* Relative wrapper for HTML label overlays */}
      <div className="relative" style={{ height: VBH }}>
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          preserveAspectRatio="none"
          className="block w-full h-full"
          role="img"
          aria-label={`Tendencia de ${series.label}`}
        >
          <defs>
            <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={series.color} stopOpacity="0.40" />
              <stop offset="100%" stopColor={series.color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Area fill */}
          <path
            d={areaPath}
            fill={`url(#grad-${id})`}
            opacity={drawn ? 1 : 0}
            style={{ transition: `opacity 0.8s ease-out ${delayMs + 200}ms` }}
          />
          {/* Line */}
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
          {/* End dot */}
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
          {/* Peak marker — small ring above the peak point so the label
              anchors to a visible feature, not just empty space. */}
          {peakPt && (
            <circle
              cx={peakPt[0]}
              cy={peakPt[1]}
              r="2.5"
              fill="rgba(255,255,255,0.85)"
              stroke={series.color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              opacity={drawn ? 1 : 0}
              style={{ transition: `opacity 0.3s ease-out ${delayMs + 900}ms` }}
            />
          )}
        </svg>

        {/* Peak label — small chip floating above the peak point */}
        {peakPt && (
          <span
            className="absolute text-[10px] font-semibold tabular-nums pointer-events-none whitespace-nowrap px-1.5 py-0.5 rounded"
            style={{
              left:            `${(peakPt[0] / VBW) * 100}%`,
              top:             `${(peakPt[1] / VBH) * 100}%`,
              transform:       peakIdx === 0
                                 ? 'translate(0, -110%)'
                                 : 'translate(-50%, -110%)',
              color:           series.color,
              backgroundColor: hexToRgba(series.color, 0.14),
              opacity:         drawn ? 1 : 0,
              transition:      `opacity 0.4s ease-out ${delayMs + 1000}ms`,
            }}
          >
            {fmt(values[peakIdx])}
          </span>
        )}

        {/* Current value label — anchored to the end dot's upper-left */}
        {last && (
          <span
            className="absolute text-[10px] font-semibold tabular-nums pointer-events-none whitespace-nowrap"
            style={{
              left:       `${(last[0] / VBW) * 100}%`,
              top:        `${(last[1] / VBH) * 100}%`,
              transform:  'translate(-100%, -130%)',
              color:      'rgb(var(--color-ink))',
              paddingRight: '6px',
              opacity:    drawn ? 1 : 0,
              transition: `opacity 0.4s ease-out ${delayMs + 1200}ms`,
            }}
          >
            {fmt(currentValue)}
          </span>
        )}
      </div>

      {xLabels && xLabels.length > 0 && (
        <div className="flex justify-between mt-0.5 text-[9px] text-slate tabular-nums">
          <span>{xLabels[0]}</span>
          <span>{xLabels.at(-1)}</span>
        </div>
      )}
    </div>
  )
}
