'use client'

// ============================================================================
// AdmiCell — the ADMI (total commission) cell on the planilla.
//
// ADMI is the SUM of the COMMISSION_OUT transactions. It is not auto-generated
// when income is loaded, so it's easy to forget — and a forgotten commission
// over-pays the owner. This cell makes it one action and assigns the bank at
// the same time (so it doesn't land unclassified):
//   • ADMI = 0 with income + a % → "Calcular" picker: choose the bank and it
//     COMPUTES ingresos × commission_pct (+IVA for RI), tagged to that bank.
//   • ADMI > 0 but unclassified → "banco?" picker: TAGS the existing amount to
//     a bank WITHOUT recomputing it (preserves a legacy / hand-entered figure
//     and its reconciliation date).
//   • ADMI classified → the amount, read-only.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateCommissionForPeriod, tagCommissionBank } from '@/lib/transaction/actions'
import { fmtMoney } from '@/lib/format'

type Dest = 'ADM_GALICIA' | 'ADM_FRANCES_50_9' | 'ADM_FRANCES_51_6'
type Mode = 'calcular' | 'tag'

interface Props {
  contractId:    string
  period:        string
  admi:          number
  ingresos:      number
  commissionPct: number | null
  /** Galicia + BBVA 50/9 + BBVA 51/6 — the classified portion of ADMI. */
  bankSum:       number
  /** cellTextClass(transferido) — keeps the recorded-amount styling. */
  textClass:     string
}

export function AdmiCell({ contractId, period, admi, ingresos, commissionPct, bankSum, textClass }: Props) {
  const [mode, setMode] = useState<Mode | null>(null)   // null = not picking
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function pick(destination: Dest) {
    setError(null)
    startTransition(async () => {
      const res = mode === 'tag'
        ? await tagCommissionBank(contractId, period, destination)          // just assign the bank
        : await generateCommissionForPeriod(contractId, period, destination) // compute + assign
      if (!res.ok) { setError(res.error ?? 'No se pudo registrar la comisión.'); return }
      setMode(null)
      router.refresh()
    })
  }

  const unclassified = admi > 0 && admi - bankSum > 1
  const canCalc      = ingresos > 0 && commissionPct != null && commissionPct > 0

  // Bank picker (shared by "Calcular" and "banco?").
  if (mode) {
    return (
      <span className="inline-flex flex-col items-end gap-0.5">
        <select
          autoFocus
          disabled={pending}
          defaultValue=""
          onChange={e => { if (e.target.value) pick(e.target.value as Dest) }}
          onBlur={() => { if (!pending) setMode(null) }}
          title="Elegí a qué banco va la comisión"
          className="h-6 max-w-full text-[11px] px-1 rounded border border-info/50 bg-paper text-ink outline-none focus:border-info"
        >
          <option value="" disabled>{pending ? 'Guardando…' : '¿Banco?'}</option>
          <option value="ADM_GALICIA">Galicia</option>
          <option value="ADM_FRANCES_50_9">BBVA 50/9</option>
          <option value="ADM_FRANCES_51_6">BBVA 51/6</option>
        </select>
        {error && <span className="text-[9px] text-danger max-w-[90px] leading-tight">{error}</span>}
      </span>
    )
  }

  // Recorded and classified → show the amount.
  if (admi > 0 && !unclassified) {
    return <span className={`tabular-nums ${textClass}`}>{fmtMoney(admi)}</span>
  }

  // Recorded but not assigned to a bank → amount + "banco?" (tag only).
  if (unclassified) {
    return (
      <span className="inline-flex items-center justify-end gap-1">
        <span className={`tabular-nums ${textClass}`}>{fmtMoney(admi)}</span>
        <button
          type="button"
          onClick={() => { setError(null); setMode('tag') }}
          title="Comisión sin banco asignado — tocá para elegir Galicia / BBVA (no cambia el monto)"
          className="text-[10px] font-medium text-warn hover:underline whitespace-nowrap"
        >banco?</button>
      </span>
    )
  }

  // Income + a configured % but nothing recorded → "Calcular" (compute + pick bank).
  if (canCalc) {
    return (
      <button
        type="button"
        onClick={() => { setError(null); setMode('calcular') }}
        title={`Calcular comisión = ingresos × ${commissionPct}%`}
        className="text-[11px] font-medium whitespace-nowrap text-info hover:underline"
      >Calcular</button>
    )
  }

  return <span className="text-slate">—</span>
}
