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

import { useEffect, useState } from 'react'
import { fmtMoney } from '@/lib/format'
import { periodLabel } from '@/lib/period'
import type { DeudaBreakdown } from '@/lib/liquidacion/deuda-breakdown'

interface Props {
  breakdown: DeudaBreakdown
}

const STORAGE_KEY = (contractId: string) => `deuda-apply-intereses:${contractId}`

export function DeudaBreakdownPanel({ breakdown }: Props) {
  // Persist the intereses checkbox per contract in localStorage. The panel
  // is unmounted every time the popover closes, so without persistence the
  // user's toggle resets to contracts.late_interest_enabled on every open.
  // Storage key is per contractId; survives modal close/reopen and reloads.
  // Falls back to the contract's stored flag when no choice has been saved.
  const [applyIntereses, setApplyIntereses] = useState<boolean>(() => {
    if (typeof window === 'undefined') return breakdown.lateInterestEnabled
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY(breakdown.contractId))
      if (stored === 'true')  return true
      if (stored === 'false') return false
    } catch { /* ignore disabled storage */ }
    return breakdown.lateInterestEnabled
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY(breakdown.contractId), String(applyIntereses))
    } catch { /* ignore */ }
  }, [applyIntereses, breakdown.contractId])
  const interesesShown = applyIntereses ? breakdown.interesesEstimado : 0
  // El saldo a favor ya se aplico mes a mes hacia adelante (ver
  // applyCreditForward), asi que lo que queda aca es el sobrante. Se resta del
  // total porque es lo que la oficina le diria al inquilino: "de esto que
  // figura, tenes tanto a favor".
  const saldo          = breakdown.saldoAFavor ?? 0
  const total          = breakdown.deudaCurrent + breakdown.deudaCarryover + interesesShown - saldo
  const aFavor         = total < 0
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
          {/* El numero contra el que se mide la deuda puede NO estar cargado en
              ningun lado: si al contrato le toca el aumento y no se confirmo, es
              una proyeccion que calcula el sistema. Alejandro, 2026-09-19:
              corrigio el monto que si habia cargado y la deuda no se movio,
              porque nunca lo estaba mirando. Decirlo acá, justo al lado del
              numero, es lo que faltaba. */}
          {breakdown.rentIsProjected && (
            <span className="col-span-2 text-[10.5px] text-warn leading-snug mt-0.5">
              Aumento proyectado, todavía sin confirmar. El contrato tiene cargado{' '}
              {fmtMoney(breakdown.contractRent)} — confirmalo desde la ficha del contrato.
            </span>
          )}
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
                ({carryoverCount} {carryoverCount === 1 ? 'mes anterior' : 'meses anteriores'})
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
                  {/* Una deuda cargada a mano no se mide contra un alquiler
                      esperado: la oficina afirma el monto desde sus propios
                      registros. Mostrarla como "cobrado $0 de $X" diria que
                      el sistema la calculo, que es justo lo que no paso. */}
                  ▸ {e.periodLabel}: {e.manual
                    ? <>cargado a mano{e.note ? ` — ${e.note}` : ''}</>
                    : e.deuda > 0
                      ? `cobrado ${fmtMoney(e.cobrado)} de ${fmtMoney(e.expectedRent)}`
                      : 'cobrado completo'}
                  {/* Cada mes envejece por su cuenta: Febrero acumula mas dias
                      que Mayo. Mostrarlo al lado de la linea es lo que hace
                      entendible que el interes no sea un solo porcentaje. */}
                  {e.deuda > 0 && (e.daysOverdue ?? 0) > 0 && (
                    <span className="text-slate"> · {e.daysOverdue} días</span>
                  )}
                </span>
                <span className="tabular-nums">
                  {e.deuda > 0 ? `+ ${fmtMoney(e.deuda)}` : '—'}
                </span>
              </li>
            ))}
          </ul>
          {/* Nota corregida 2026-09-11. Decia "Asume alquiler vigente actual
              ...los valores historicos pueden variar levemente si hubo
              aumentos", que desde el cambio del 2026-09-10 ya no es cierto:
              cada mes anterior se valua al alquiler que regia EN ESE MES,
              tomado de la tabla de aumentos. Dejar la nota vieja le decia al
              usuario que el numero era aproximado cuando ya no lo es. */}
          <p className="text-[10px] text-slate italic mt-1.5 leading-snug">
            Cada mes se cuenta al alquiler que regía en ese momento, según el historial de aumentos del contrato.
            {breakdown.carryover.some(e => e.manual) && ' Los meses marcados “cargado a mano” los registró la oficina.'}
          </p>
        </div>
      )}

      {/* Intereses (toggleable) */}
      {hasIntereses && (
        <div className="mb-3">
          <label className="flex items-baseline justify-between gap-3 cursor-pointer select-none">
            <span className="text-slate-dark">
              Intereses por mora{' '}
              {/* Con meses arrastrados NO hay un solo numero de dias: cada mes
                  se cuenta desde su propio dia 1, igual que en la planilla de
                  la oficina. Mostrar los dias del mes corriente ahi seria
                  mentir sobre como se calculo el total. */}
              <span className="text-[10.5px] text-slate">
                {carryoverCount > 0
                  ? `(${breakdown.lateInterestRate}% diario, contado mes por mes)`
                  : `(${breakdown.lateInterestRate}% diario × ${breakdown.daysOverdue} ${breakdown.daysOverdue === 1 ? 'día' : 'días'} de atraso)`}
              </span>
            </span>
            <span className="inline-flex items-baseline gap-2">
              <span className={`tabular-nums ${applyIntereses ? 'text-ink' : 'text-slate line-through'}`}>
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

      {/* Saldo a favor — lo que pago de mas y todavia no se consumio. */}
      {saldo > 0 && (
        <div className="mb-3">
          <div className="grid grid-cols-[1fr_auto] gap-x-3 items-baseline">
            <span className="text-slate-dark">Saldo a favor</span>
            <span className="tabular-nums text-success">− {fmtMoney(saldo)}</span>
          </div>
          <p className="text-[10px] text-slate italic mt-1 leading-snug">
            Pagó de más en meses anteriores. Se descuenta de lo que deba, antes de
            calcular intereses. La plata ya se le transfirió al propietario.
          </p>
        </div>
      )}

      {/* Total */}
      <div className="border-t-2 border-ink pt-2 grid grid-cols-[1fr_auto] gap-x-3 items-baseline">
        <span className="text-ink font-medium text-[13px]">{aFavor ? 'A favor del inquilino' : 'Total'}</span>
        <span className={`tabular-nums font-display font-semibold text-[16px] ${
          total > 0 ? 'text-danger' : aFavor ? 'text-success' : 'text-ink'
        }`}>
          {fmtMoney(Math.abs(total))}
        </span>
      </div>
    </div>
  )
}
