// ============================================================================
// CollectionHealthCard — Panel 1 of /dashboard. Answers "did the rents come
// in this month?" in one glance:
//
//   • Massive percentage of contracts paid this period (the headline number)
//   • Color-coded health pill (ok / atención / atrasada)
//   • Two-segment progress bar showing paid vs unpaid count
//   • Money side: collected vs pending amounts
//   • A second progress bar for amount-collected % when it differs from the
//     count rate (most common cause: a few late tenants own large rents)
//
// Single SVG arc + plain Tailwind for the bars — no chart library needed.
// ============================================================================

import Link from 'next/link'
import { fmtMoney } from '@/lib/format'
import type { CollectionHealth } from '@/lib/dashboard/queries'

interface Props {
  data: CollectionHealth
}

const STATUS_THEME: Record<CollectionHealth['status'], { dotBg: string; label: string; text: string; arc: string }> = {
  ok: {
    dotBg: 'bg-success',
    label: 'Al día',
    text:  'text-success',
    arc:   'rgb(var(--color-success))',
  },
  warning: {
    dotBg: 'bg-warn',
    label: 'Atención',
    text:  'text-warn',
    arc:   'rgb(var(--color-warn))',
  },
  critical: {
    dotBg: 'bg-danger',
    label: 'Atrasada',
    text:  'text-danger',
    arc:   'rgb(var(--color-danger))',
  },
}

export function CollectionHealthCard({ data }: Props) {
  const theme = STATUS_THEME[data.status]
  const pct   = Math.round(data.collectionRateByCount)

  return (
    <div className="flex flex-col gap-5">
      {/* Headline: ring + percentage + status */}
      <div className="flex items-center gap-6">
        <CollectionRing pct={pct} stroke={theme.arc} />
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 mb-1">
            <span className={`w-1.5 h-1.5 rounded-full ${theme.dotBg}`} />
            <span className={`text-[10px] uppercase tracking-wider font-medium ${theme.text}`}>
              {theme.label}
            </span>
          </div>
          <p className="text-[12px] text-slate-dark leading-snug">
            <span className="text-ink font-medium tabular-nums">{data.paidCount}</span> de{' '}
            <span className="text-ink font-medium tabular-nums">{data.totalContracts}</span> contratos cobrados
          </p>
          {data.unpaidCount > 0 && (
            <Link
              href="/pendientes?tipo=cobranza"
              className="inline-flex items-center gap-1 text-[11px] text-slate hover:text-ink transition-colors mt-1"
            >
              Ver {data.unpaidCount} {data.unpaidCount === 1 ? 'pendiente' : 'pendientes'} →
            </Link>
          )}
        </div>
      </div>

      {/* Amount breakdown — only render when there's data */}
      {data.expectedAmount > 0 && (
        <div className="pt-4 border-t border-line">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="label-cap text-slate mb-1">Cobrado</p>
              <p className="font-display text-[18px] font-medium text-ink tabular-nums leading-none">
                {fmtMoney(data.collectedAmount)}
              </p>
            </div>
            <div>
              <p className="label-cap text-slate mb-1">Pendiente</p>
              <p className={`font-display text-[18px] font-medium tabular-nums leading-none ${data.pendingAmount > 0 ? 'text-ink' : 'text-slate'}`}>
                {fmtMoney(data.pendingAmount)}
              </p>
            </div>
          </div>

          {/* Two-segment amount bar — visual ratio of collected vs pending. */}
          <div className="flex h-1.5 mt-3 rounded-full overflow-hidden bg-cream-2">
            <div
              className="h-full"
              style={{
                width:           `${data.collectionRateByAmount}%`,
                backgroundColor: theme.arc,
                transition:      'width 0.4s ease-out',
              }}
            />
          </div>
          <p className="text-[11px] text-slate tabular-nums mt-1.5">
            {data.collectionRateByAmount.toFixed(0)}% del monto esperado
          </p>
        </div>
      )}
    </div>
  )
}

/** SVG ring that fills clockwise to `pct` of a full circle. */
function CollectionRing({ pct, stroke }: { pct: number; stroke: string }) {
  const radius      = 38
  const strokeWidth = 7
  const cx          = radius + strokeWidth
  const cy          = radius + strokeWidth
  const size        = (radius + strokeWidth) * 2
  const circumference = 2 * Math.PI * radius
  const dashOffset    = circumference * (1 - pct / 100)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block -rotate-90">
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="rgb(var(--color-cream-2))"
          strokeWidth={strokeWidth}
        />
        {/* Filled arc */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      {/* Center label — absolute-positioned over the ring */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <p className="font-display text-[26px] font-semibold text-ink tabular-nums leading-none">
          {pct}<span className="text-[14px] text-slate ml-0.5">%</span>
        </p>
      </div>
    </div>
  )
}
