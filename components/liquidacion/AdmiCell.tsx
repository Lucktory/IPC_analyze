'use client'

// ============================================================================
// AdmiCell — the ADMI (total commission) cell on the planilla.
//
// ADMI is the SUM of the COMMISSION_OUT transactions. Its destination bank is a
// DURABLE property of the contract (contracts.commission_destination): Alejandro
// assigns each administración to a bank once, and every period's commission
// inherits it. This cell is the editor for that assignment:
//   • commission recorded → click the amount to CHOOSE or CHANGE the bank
//     (banco 1 Galicia / banco 2 BBVA 50-9 / banco 3 BBVA 51-6). Moving a
//     contract to another bank (a bank closes, etc.) is one click. If it's not
//     yet classified, a "banco?" hint nudges to assign one.
//   • no commission yet, income + a % → "Calcular": pick the bank, it COMPUTES
//     ingresos × commission_pct (+IVA for RI), tags it, and stores the default.
// Not every commission needs a bank — unpaid contracts have none, which is fine.
// ============================================================================

import { useState } from 'react'
import { useBusyTransition } from '@/components/shell/NavProgress'
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
  const [pending, startTransition] = useBusyTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function pick(destination: Dest) {
    setError(null)
    startTransition(async () => {
      // Both route through setCommission, which sets the contract's durable
      // default bank whenever an explicit destination is passed (one writer, no
      // divergence): Calcular computes + tags, tagCommissionBank assigns/moves.
      const res = mode === 'calcular'
        ? await generateCommissionForPeriod(contractId, period, destination)
        : await tagCommissionBank(contractId, period, destination)
      if (!res.ok) { setError(res.error ?? 'No se pudo registrar la comisión.'); return }
      setMode(null)
      router.refresh()
    })
  }

  const unclassified = admi > 0 && admi - bankSum > 1
  const canCalc      = ingresos > 0 && commissionPct != null && commissionPct > 0

  // Bank picker (shared by "Calcular", "banco?", and re-assigning a bank).
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

  // Recorded → the amount is click-to-edit the bank. "banco?" hint when unclassified.
  if (admi > 0) {
    return (
      <span className="inline-flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => { setError(null); setMode('tag') }}
          title="Tocá para elegir o cambiar el banco de la comisión"
          className={`tabular-nums hover:underline ${textClass}`}
        >{fmtMoney(admi)}</button>
        {unclassified && (
          <button
            type="button"
            onClick={() => { setError(null); setMode('tag') }}
            title="Comisión sin banco asignado — tocá para elegir Galicia / BBVA"
            className="text-[10px] font-medium text-warn hover:underline whitespace-nowrap"
          >banco?</button>
        )}
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
