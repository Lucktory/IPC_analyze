'use client'

// ============================================================================
// DeudaBreakdownPanel — pure presentational breakdown of contract debt.
//
// Used both inside the planilla's per-row Deuda popover AND as an embedded
// section on /contratos/[id]. Doesn't fetch — the data shape is built by
// lib/liquidacion/deuda-breakdown.ts and passed in.
//
// Layout:
//   • This period's expected rent vs cobrado → "Deuda este período"
//   • Last 3 prior periods, expanded → "Adeudado anterior"
//   • Intereses por mora line with a checkbox (defaults from
//     contracts.late_interest_enabled). Toggle updates the visible total
//     live but doesn't persist or auto-create a LATE_FEE_IN.
//   • Final total bolded
// ============================================================================

import { useState } from 'react'
import { fmtMoney } from '@/lib/format'
import { periodLabel } from '@/lib/period'
import type { DeudaBreakdown } from '@/lib/liquidacion/deuda-breakdown'

interface Props {
  breakdown: DeudaBreakdown
}

export function DeudaBreakdownPanel({ breakdown }: Props) {
  const [applyIntereses, setApplyIntereses] = useState(breakdown.lateInterestEnabled)
  const interesesShown = applyIntereses ? breakdown.interesesEstimado : 0
  const total          = breakdown.deudaCurrent + breakdown.deudaCarryover + interesesShown
  const carryoverCount = breakdown.carryover.length
  const hasIntereses   = breakdown.lateInterestRate > 0 && breakdown.daysOverdue > 0 && breakdown.interesesEstimado > 0

  return (
    <div className="text-[12.5px]">
      <p className="font-display text-[14px] font-medium text-ink mb-3">
        Deuda · {periodLabel(breakdown.period)}
      </p>

      {/* This period */}
      <div className="mb-3">
        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 items-baseline">
          <span className="text-slate-dark">Alquiler {periodLabel(breakdown.period)}</span>
          <span className="tabular-nums text-ink">{fmtMoney(breakdown.expectedRent)}</span>
          <span className="text-slate-dark">Cobrado este período</span>
          <span className="tabular-nums text-ink">- {fmtMoney(breakdown.cobradoThisPeriod)}</span>
        </div>
        <div className="border-t border-line/60 mt-2 pt-2 grid grid-cols-[1fr_auto] gap-x-3">
          <span className="text-ink font-medium">Deuda este período</span>
          <span className={`tabular-nums font-medium ${breakdown.deudaCurrent > 0 ? 'text-danger' : 'text-ink'}`}>
            {fmtMoney(breakdown.deudaCurrent)}
          </span>
        </div>
      </div>

      {/* Carryover */}
      {carryoverCount > 0 && (
        <div className="mb-3">
          <div className="grid grid-cols-[1fr_auto] gap-x-3 items-baseline">
            <span className="text-slate-dark">
              Adeudado anterior{' '}
              <span className="text-[10.5px] text-slate">
                (últimos {carryoverCount} {carryoverCount === 1 ? 'mes' : 'meses'})
              </span>
            </span>
            <span className={`tabular-nums ${breakdown.deudaCarryover > 0 ? 'text-danger' : 'text-ink'}`}>
              {breakdown.deudaCarryover > 0 ? '+ ' : ''}{fmtMoney(breakdown.deudaCarryover)}
            </span>
          </div>
          <ul className="mt-1 ml-3 space-y-0.5">
            {breakdown.carryover.map(e => (
              <li key={e.period} className="grid grid-cols-[1fr_auto] gap-x-3 text-[11.5px] text-slate">
                <span>
                  ▸ {e.periodLabel}: {e.deuda > 0
                    ? `cobrado ${fmtMoney(e.cobrado)} de ${fmtMoney(e.expectedRent)}`
                    : 'cobrado completo'}
                </span>
                <span className="tabular-nums">
                  {e.deuda > 0 ? `+ ${fmtMoney(e.deuda)}` : '—'}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-slate italic mt-1.5 leading-snug">
            Asume alquiler vigente actual ({fmtMoney(breakdown.expectedRent)}); los valores históricos pueden variar levemente si hubo aumentos.
          </p>
        </div>
      )}

      {/* Intereses (toggleable) */}
      {hasIntereses && (
        <div className="mb-3">
          <label className="flex items-baseline justify-between gap-3 cursor-pointer select-none">
            <span className="text-slate-dark">
              Intereses por mora{' '}
              <span className="text-[10.5px] text-slate">
                ({breakdown.lateInterestRate}% mensual × {breakdown.daysOverdue} {breakdown.daysOverdue === 1 ? 'día' : 'días'} de atraso)
              </span>
            </span>
            <span className="inline-flex items-baseline gap-2">
              <span className={`tabular-nums ${applyIntereses ? 'text-ink' : 'text-gray-400 line-through'}`}>
                + {fmtMoney(breakdown.interesesEstimado)}
              </span>
              <input
                type="checkbox"
                checked={applyIntereses}
                onChange={e => setApplyIntereses(e.target.checked)}
                className="h-3.5 w-3.5 accent-ink"
              />
            </span>
          </label>
          <p className="text-[10px] text-slate italic mt-1 leading-snug">
            Es una estimación. Si decidís cobrar, registralo manualmente como LATE_FEE_IN en Movs.
          </p>
        </div>
      )}

      {/* Total */}
      <div className="border-t-2 border-ink pt-2 grid grid-cols-[1fr_auto] gap-x-3 items-baseline">
        <span className="text-ink font-medium text-[13px]">Total</span>
        <span className={`tabular-nums font-display font-semibold text-[16px] ${total > 0 ? 'text-danger' : 'text-ink'}`}>
          {fmtMoney(total)}
        </span>
      </div>
    </div>
  )
}
