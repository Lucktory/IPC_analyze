'use client'

// ============================================================================
// AdmiCell — the ADMI (total commission) cell on the planilla.
//
// ADMI is the SUM of the COMMISSION_OUT transactions (entered per bank in the
// Galicia / BBVA columns). It is NOT auto-generated when income is loaded, so
// it's easy to forget — and a forgotten commission over-pays the owner.
//
// This cell makes it one click: when there's income and a configured % but no
// commission recorded yet (admi = 0), it shows a "Calcular" button that runs
// generateCommissionForPeriod (ingresos x commission_pct, +IVA when RI). Once
// recorded, it shows the amount read-only, same as before.
//
// Note: the generated commission is not yet assigned to a bank (it lands in the
// ADMI total, unclassified). The encargada can move it to Galicia/BBVA from
// those columns if the split matters.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateCommissionForPeriod } from '@/lib/transaction/actions'
import { fmtMoney } from '@/lib/format'

interface Props {
  contractId:    string
  period:        string
  admi:          number
  ingresos:      number
  commissionPct: number | null
  /** cellTextClass(transferido) — keeps the recorded-amount styling consistent. */
  textClass:     string
}

export function AdmiCell({ contractId, period, admi, ingresos, commissionPct, textClass }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function calcular() {
    setError(null)
    startTransition(async () => {
      const res = await generateCommissionForPeriod(contractId, period)
      if (!res.ok) { setError(res.error ?? 'No se pudo calcular la comisión.'); return }
      router.refresh()
    })
  }

  // Commission already recorded → show the total (read-only).
  if (admi > 0) {
    return <span className={`tabular-nums ${textClass}`}>{fmtMoney(admi)}</span>
  }

  // Income + a configured % but nothing recorded → offer to calculate it.
  if (ingresos > 0 && commissionPct != null && commissionPct > 0) {
    return (
      <button
        type="button"
        onClick={calcular}
        disabled={pending}
        title={error ?? `Calcular comisión = ingresos × ${commissionPct}%`}
        className={`text-[11px] font-medium whitespace-nowrap disabled:opacity-60 ${error ? 'text-danger' : 'text-info hover:underline'}`}
      >
        {pending ? 'Calculando…' : 'Calcular'}
      </button>
    )
  }

  return <span className="text-slate">—</span>
}
