'use client'

// ============================================================================
// RadialGauge — semi-circle "speedometer" with three zone tints (red 0-60%,
// amber 60-85%, green 85-100%) and a colored arc that sweeps in from 0 on
// mount, with a needle dot at the current value.
//
// Gradient fill on the arc gives it depth (lighter at the start, base at
// the current value). Animation drives via stroke-dashoffset so we get a
// smooth sweep regardless of percentage.
// ============================================================================

import { useEffect, useId, useState } from 'react'

interface Props {
  /** 0-100. Clamped. */
  pct:    number
  /** Drives the colored arc + needle ring color. */
  status: 'ok' | 'warning' | 'critical'
}

const SIZE         = 220
const STROKE_WIDTH = 16
const RADIUS       = 80
const CX           = SIZE / 2
const CY           = SIZE * 0.62

const ZONES = [
  { start: 0,   end: 60,  cssVar: '--color-danger'  },
  { start: 60,  end: 85,  cssVar: '--color-warn'    },
  { start: 85,  end: 100, cssVar: '--color-success' },
]

const STATUS_VAR: Record<Props['status'], string> = {
  ok:       '--color-success',
  warning:  '--color-warn',
  critical: '--color-danger',
}

const pctToAngle = (p: number) => 180 + (p / 100) * 180

function polarToCartesian(angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180
  return {
    x: CX + Math.cos(angleRad) * RADIUS,
    y: CY + Math.sin(angleRad) * RADIUS,
  }
}

function arcPath(startDeg: number, endDeg: number) {
  if (Math.abs(endDeg - startDeg) < 0.1) return ''
  const start    = polarToCartesian(startDeg)
  const end      = polarToCartesian(endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

export function RadialGauge({ pct, status }: Props) {
  const clamped      = Math.max(0, Math.min(100, pct))
  const currentAngle = pctToAngle(clamped)
  const pointer      = polarToCartesian(currentAngle)
  const containerH   = SIZE * 0.7
  const gradientId   = `gauge-grad-${useId().replace(/:/g, '')}`

  // Animate from 0 → clamped on mount. The two-RAF dance ensures the
  // browser paints the initial state (offset=fullDash) before we kick
  // off the transition.
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setAnimated(true))
    })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [])

  // Stroke dash math: pathLength="1" makes the path treat itself as 1 unit
  // long, so offset 1 = invisible, offset 0 = fully drawn.
  const fillRatio = clamped / 100

  // Pointer position is final from the start — but its OPACITY animates in
  // so it doesn't pop in awkwardly before the arc reaches it.
  return (
    <div className="flex flex-col items-center">
      <svg width="100%" viewBox={`0 0 ${SIZE} ${containerH}`} className="block max-w-[260px]">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor={`rgb(var(${STATUS_VAR[status]}))`} stopOpacity="0.55" />
            <stop offset="100%" stopColor={`rgb(var(${STATUS_VAR[status]}))`} stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <path
          d={arcPath(180, 360)}
          fill="none"
          stroke="rgb(var(--color-cream-2))"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />
        {/* Soft zone tints */}
        {ZONES.map(z => (
          <path
            key={z.cssVar}
            d={arcPath(pctToAngle(z.start), pctToAngle(z.end))}
            fill="none"
            stroke={`rgb(var(${z.cssVar}))`}
            strokeWidth={STROKE_WIDTH}
            strokeOpacity={0.18}
          />
        ))}
        {/* Filled arc — gradient fill, animated stroke-dashoffset */}
        {clamped > 0 && (
          <path
            d={arcPath(180, 360)}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray={`${fillRatio} 1`}
            strokeDashoffset={animated ? 0 : fillRatio}
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        )}
        {/* Needle dot — fades in after the arc */}
        <circle
          cx={pointer.x}
          cy={pointer.y}
          r={9}
          fill="rgb(var(--color-paper))"
          stroke={`rgb(var(${STATUS_VAR[status]}))`}
          strokeWidth={3}
          opacity={animated ? 1 : 0}
          style={{ transition: 'opacity 0.4s ease-out 0.9s' }}
        />

        {/* Big percentage label */}
        <text
          x={CX}
          y={CY - 8}
          textAnchor="middle"
          style={{
            fontFamily: 'Lexend',
            fontSize:   36,
            fontWeight: 600,
            fill:       'rgb(var(--color-ink))',
          }}
        >
          {Math.round(clamped)}%
        </text>
      </svg>
    </div>
  )
}
