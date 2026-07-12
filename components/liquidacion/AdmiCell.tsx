'use client'

// ============================================================================
// AdmiCell — the ADMI (total commission) cell on the planilla.
//
// ADMI is the SUM of the COMMISSION_OUT transactions. It is not auto-generated
// when income is loaded, so it's easy to forget — and a forgotten commission
// over-pays the owner.
//
// This cell makes it one action, and — key fix — assigns the commission to a
// BANK at the same time, so it doesn't land unclassified (which would raise the
// "ADMI sin marcador de destino" warning and, worse, double if you then typed
// it into a bank column):
//   • ADMI = 0 with income + a % → a "Calcular" picker: choose the bank and it
//     records ingresos × commission_pct (+IVA for RI) tagged to that bank.
//   • ADMI > 0 but unclassified (no bank marker) → shows the amount plus a
//     "banco?" picker to tag it to a bank (recomputes into one row, no double).
//   • ADMI classified → the amount, read-only.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateCommissionForPeriod } from '@/lib/transaction/actions'
import { fmtMoney } from '@/lib/format'

type Dest = 'ADM_GALICIA' | 'ADM_FRANCES_50_9' | 'ADM_FRANCES_51_6'

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
  const [picking, setPicking] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function run(destination: Dest) {
    setError(null)
    startTransition(async () => {
      const res = await generateCommissionForPeriod(contractId, period, destination)
      if (!res.ok) { setError(res.error ?? 'No se pudo calcular la comisión.'); return }
      setPicking(false)
      router.refresh()
    })
  }

  const unclassified = admi > 0 && admi - bankSum > 1
  const canCalc      = ingresos > 0 && commissionPct != null && commissionPct > 0

  // Bank picker (shared by "Calcular" and "banco?").
  if (picking) {
    return (
      <select
        autoFocus
        disabled={pending}
        defaultValue=""
        onChange={e => { if (e.target.value) run(e.target.value as Dest) }}
        onBlur={() => setPicking(false)}
        title={error ?? 'Elegí a qué banco va la comisión'}
        className="h-6 max-w-full text-[11px] px-1 rounded border border-info/50 bg-paper text-ink outline-none focus:border-info"
      >
        <option value="" disabled>{pending ? 'Calculando…' : '¿Banco?'}</option>
        <option value="ADM_GALICIA">Galicia</option>
        <option value="ADM_FRANCES_50_9">BBVA 50/9</option>
        <option value="ADM_FRANCES_51_6">BBVA 51/6</option>
      </select>
    )
  }

  // Recorded and classified → show the amount.
  if (admi > 0 && !unclassified) {
    return <span className={`tabular-nums ${textClass}`}>{fmtMoney(admi)}</span>
  }

  // Recorded but not assigned to a bank → amount + "banco?" to classify it.
  if (unclassified) {
    return (
      <span className="inline-flex items-center justify-end gap-1">
        <span className={`tabular-nums ${textClass}`}>{fmtMoney(admi)}</span>
        <button
          type="button"
          onClick={() => setPicking(true)}
          title="Comisión sin banco asignado — tocá para elegir Galicia / BBVA"
          className="text-[10px] font-medium text-warn hover:underline whitespace-nowrap"
        >banco?</button>
      </span>
    )
  }

  // Income + a configured % but nothing recorded → "Calcular" (pick the bank).
  if (canCalc) {
    return (
      <button
        type="button"
        onClick={() => setPicking(true)}
        title={error ?? `Calcular comisión = ingresos × ${commissionPct}%`}
        className={`text-[11px] font-medium whitespace-nowrap ${error ? 'text-danger' : 'text-info hover:underline'}`}
      >Calcular</button>
    )
  }

  return <span className="text-slate">—</span>
}
