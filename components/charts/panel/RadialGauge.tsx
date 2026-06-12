// ============================================================================
// RadialGauge — a semi-circle "speedometer" with three colored zones
// (red 0-60%, amber 60-85%, green 85-100%) and a pointer at the current value.
//
// Pure SVG, no chart library. Colors read from CSS variables so it adapts
// to the active theme automatically. The big percentage label lives inside
// the gauge so the eye reads it together with the needle position.
// ============================================================================

interface Props {
  /** 0-100. Clamped to [0, 100]. */
  pct:    number
  /** Drives the pointer + filled-arc color. */
  status: 'ok' | 'warning' | 'critical'
}

const SIZE         = 220
const STROKE_WIDTH = 16
const RADIUS       = 80
const CX           = SIZE / 2
const CY           = SIZE * 0.62

// Zone thresholds — 0..60 red, 60..85 amber, 85..100 green.
// These mirror the CollectionHealth status thresholds in the query.
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

/** Map 0..100 → 180°..360°. 180° = leftmost point, 360°/0° = rightmost. */
const pctToAngle = (p: number) => 180 + (p / 100) * 180

function polarToCartesian(angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180
  return {
    x: CX + Math.cos(angleRad) * RADIUS,
    y: CY + Math.sin(angleRad) * RADIUS,
  }
}

function arcPath(startDeg: number, endDeg: number) {
  if (Math.abs(endDeg - startDeg) < 0.1) return ''  // degenerate
  const start    = polarToCartesian(startDeg)
  const end      = polarToCartesian(endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

export function RadialGauge({ pct, status }: Props) {
  const clamped       = Math.max(0, Math.min(100, pct))
  const currentAngle  = pctToAngle(clamped)
  const pointer       = polarToCartesian(currentAngle)

  // Container height = half of full size + a little extra for the label below
  const containerH = SIZE * 0.7

  return (
    <div className="flex flex-col items-center">
      <svg width="100%" viewBox={`0 0 ${SIZE} ${containerH}`} className="block max-w-[260px]">
        {/* Background track */}
        <path
          d={arcPath(180, 360)}
          fill="none"
          stroke="rgb(var(--color-cream-2))"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />
        {/* Soft zone tints — show the user the "where am I" context */}
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
        {/* Filled arc — the actual value, drawn in the status color */}
        {clamped > 0 && (
          <path
            d={arcPath(180, currentAngle)}
            fill="none"
            stroke={`rgb(var(${STATUS_VAR[status]}))`}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            style={{ transition: 'd 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        )}
        {/* Pointer dot at the current position */}
        <circle
          cx={pointer.x}
          cy={pointer.y}
          r={9}
          fill="rgb(var(--color-paper))"
          stroke={`rgb(var(${STATUS_VAR[status]}))`}
          strokeWidth={3}
        />

        {/* Big percentage label, centered horizontally inside the gauge */}
        <text
          x={CX}
          y={CY - 8}
          textAnchor="middle"
          className="fill-ink"
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
