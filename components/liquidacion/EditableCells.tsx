'use client'

// ============================================================================
// EditableCells — thin client wrappers that bind the per-cell server
// actions to the generic inline editors. Each one accepts the row's ids
// + the current value and renders the matching editor.
//
// Why per-cell wrappers instead of inline closures: the LiquidacionGrid is
// a server component, so it cannot build closures over contractId across
// the RSC boundary. These wrappers do the binding on the client.
// ============================================================================

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { InlineNumberCell } from './InlineNumberCell'
import { InlineSelectCell } from './InlineSelectCell'
import { InlineDateRangeCell } from './InlineDateRangeCell'
import {
  updateContractLfa,
  updateContractExpensas,
  updateContractVigencia,
  upsertCellTransaction,
  cycleLiquidacionStatus,
  type DestinationCode,
} from '@/lib/contract/inline-field-actions'
import { updateCommissionPctAndRecalc } from '@/lib/transaction/actions'
import type { LiquidacionStatus } from '@/lib/liquidacion/queries'
import { COMMISSION_IVA_RATE } from '@/lib/liquidacion/thresholds'
import { fmtMoney } from '@/lib/format'

// ── Money-cell validators ──────────────────────────────────────────────────
// Returned by the EditableTransactionCell wrapper to flag amounts that look
// "off" before the encargada commits them. Each returns:
//   • null            → no warning, commit silently
//   • { warn, message } → surface inline "confirmar?" panel in the popover
//
// Tolerance: 15% off-target counts as a real warning. Tighter than that
// triggers on every minor late-fee adjustment; looser misses big typos.

const TOLERANCE = 0.15

function validateRentIn(currentRent: number) {
  return (n: number) => {
    if (currentRent <= 0) return null
    const diff = Math.abs(n - currentRent) / currentRent
    if (diff < TOLERANCE) return null
    const pct = (diff * 100).toFixed(0)
    const dir = n > currentRent ? 'mayor' : 'menor'
    return {
      warn:    true,
      message: `El monto ingresado (${fmtMoney(n)}) es ${pct}% ${dir} que el alquiler vigente (${fmtMoney(currentRent)}). Verificá que no sea un error de tipeo.`,
    }
  }
}

function validateCommissionAmount(maxPlausible: number) {
  return (n: number) => {
    if (maxPlausible <= 0) return null
    if (n <= maxPlausible) return null
    return {
      warn:    true,
      message: `El monto (${fmtMoney(n)}) supera la comisión total esperada para el período (${fmtMoney(maxPlausible)}). Confirmá antes de guardar.`,
    }
  }
}

const LFA_OPTIONS = [
  { value: 'L',  label: 'L (Lisa)'     },
  { value: 'F',  label: 'F (Flavio)'   },
  { value: 'A',  label: 'A (Alejandro)' },
  { value: 'FL', label: 'FL (Flavio + Lisa)' },
  { value: 'D',  label: 'D (Dorso)'    },
]

// ── LFA ────────────────────────────────────────────────────────────────────
export function EditableLfaCell({ contractId, value }: { contractId: string; value: string | null }) {
  return (
    <InlineSelectCell
      value={value}
      options={LFA_OPTIONS}
      onSave={(next) => updateContractLfa(contractId, next)}
      displayClassName={value ? 'text-ink font-medium' : 'text-slate'}
      title="L/F/A — responsable del contrato"
    />
  )
}

// ── Expensas ───────────────────────────────────────────────────────────────
export function EditableExpensasCell({
  contractId, value, cobrado,
}: { contractId: string; value: number | null; cobrado: boolean }) {
  return (
    <InlineNumberCell
      value={value}
      format="money"
      min={0}
      unit="$"
      onSave={(n) => updateContractExpensas(contractId, n)}
      displayClassName={cobrado ? 'text-ink' : 'text-slate'}
      title="Expensas mensuales del contrato"
    />
  )
}

// ── Pct (commission %) ─────────────────────────────────────────────────────
//
// Editing the % saves contracts.commission_pct AND recomputes the period's
// COMMISSION_OUT at the new rate (updateCommissionPctAndRecalc), so the
// effective % shown here actually moves instead of snapping back. The confirm
// panel previews the impact: ADMI registrada ($X) → $Y, where $Y = ingresos ×
// n% — the exact figure the recompute writes.
export function EditableCommissionPctCell({
  contractId, period, value, ingresos, admi, includesIva, cobrado,
}: {
  contractId: string
  period:     string
  /** Configured commission % (null when the contract has none set yet). */
  value:      number | null
  ingresos:   number
  admi:       number
  /** RI invoicer → the recorded commission carries 21% IVA. Must match the
   *  recompute so the preview shows the figure that actually gets written. */
  includesIva: boolean
  cobrado:    boolean
}) {
  // Only ask to confirm when the recorded commission actually changes.
  // Compare the formatted figures so the gate uses fmtMoney's own rounding —
  // no duplicated precision constant, no magic tolerance.
  function validate(n: number) {
    if (ingresos <= 0) {
      return {
        warn:    true,
        message: `Todavía no hay cobros en el período. Se guarda el ${n}% y se aplica cuando entre el primer cobro.`,
      }
    }
    // Match generateCommissionForPeriod exactly: RI invoicers add 21% IVA.
    const ivaFactor = includesIva ? 1 + COMMISSION_IVA_RATE : 1
    const expected  = (ingresos * n / 100) * ivaFactor
    if (fmtMoney(expected) === fmtMoney(admi)) return null
    return {
      warn:    true,
      message: `La comisión del período pasa de ${fmtMoney(admi)} a ${fmtMoney(expected)} (${n}%${includesIva ? ' + IVA' : ''} sobre lo cobrado).`,
    }
  }

  return (
    <InlineNumberCell
      value={value}
      format="percent"
      min={0}
      max={100}
      unit="%"
      validate={validate}
      confirmTitle="¿Recalcular la comisión?"
      onSave={(n) => updateCommissionPctAndRecalc(contractId, period, n)}
      displayClassName={cobrado ? 'text-ink' : 'text-slate'}
      title="Comisión de administración (% sobre total cobrado) — al cambiarla, recalcula la comisión del período"
    />
  )
}

// ── Vigencia (start_date / end_date) ───────────────────────────────────────
export function EditableVigenciaCell({
  contractId, startDate, endDate,
}: { contractId: string; startDate: string | null; endDate: string | null }) {
  return (
    <InlineDateRangeCell
      startDate={startDate}
      endDate={endDate}
      onSave={(s, e) => updateContractVigencia(contractId, s, e)}
      displayClassName={startDate || endDate ? 'text-slate-dark' : 'text-slate/60'}
      title="Vigencia del contrato"
    />
  )
}

// ── Transaction amount (Ingresos / Otros / ADM Galicia / 50-9 / 51-6) ──────
//
// Two optional context props enable the per-cell validator:
//   • expectedRent     — for RENT_IN cells: flags amounts >15% off contract rent
//   • maxPlausibleComm — for COMMISSION_OUT cells: flags amounts greater than
//                         the expected total commission for the period
//                         (computed by the caller as ingresos × pct/100)
//
// Validation runs locally before the server call. The encargada either
// confirms or returns to editing. Either way the data is never silently
// committed when it falls outside reasonable bounds.
export function EditableTransactionCell({
  contractId, period, typeCode, destination = null, value, cobrado, label,
  expectedRent, maxPlausibleComm,
}: {
  contractId:        string
  period:            string
  typeCode:          string
  destination?:      DestinationCode
  value:             number
  cobrado:           boolean
  label?:            string
  expectedRent?:     number
  maxPlausibleComm?: number
}) {
  const validate =
    typeCode === 'RENT_IN' && expectedRent != null && expectedRent > 0
      ? validateRentIn(expectedRent)
      : typeCode === 'COMMISSION_OUT' && maxPlausibleComm != null && maxPlausibleComm > 0
        ? validateCommissionAmount(maxPlausibleComm)
        : undefined

  return (
    <InlineNumberCell
      value={value > 0 ? value : null}
      format="money"
      min={0}
      unit="$"
      onSave={(n) => upsertCellTransaction(contractId, period, typeCode, n, null, label ?? null, destination)}
      displayClassName={cobrado ? 'text-ink' : 'text-slate'}
      title={label}
      validate={validate}
    />
  )
}

// ── Estado cycle (borrador → enviada → pagada) ─────────────────────────────
export function EditableStatusCell({
  contractId, landlordId, period, status,
}: {
  contractId: string
  landlordId: string
  period:     string
  status:     LiquidacionStatus
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useState<LiquidacionStatus | null>(null)
  const router = useRouter()

  const shown = optimistic ?? status
  const nextStatus = shown === 'draft' ? 'sent' : shown === 'sent' ? 'paid' : 'draft'

  const dotCls =
    shown === 'draft' ? 'bg-gray-400' :
    shown === 'sent'  ? 'bg-success'  :
                        'bg-info'
  const labelCls =
    shown === 'draft' ? 'Borrador'   :
    shown === 'sent'  ? 'Enviada'    :
                        'Pagada'

  function cycle() {
    setOptimistic(nextStatus)
    setError(null)
    startTransition(async () => {
      const res = await cycleLiquidacionStatus(contractId, landlordId, period, shown)
      if (!res.ok) {
        setOptimistic(null)
        setError(res.error ?? 'Error al cambiar estado')
      } else {
        router.refresh()
      }
    })
  }

  return (
    <button
      type="button"
      onClick={cycle}
      disabled={pending}
      title={`Estado: ${labelCls} · Click para pasar a ${
        nextStatus === 'draft' ? 'borrador' : nextStatus === 'sent' ? 'enviada' : 'pagada'
      }`}
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors ${pending ? 'opacity-60' : ''}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${dotCls}`} />
      <span className="text-[10px] text-slate-dark">{labelCls.slice(0, 4)}</span>
      {error && <span className="text-[9px] text-danger" title={error}>!</span>}
    </button>
  )
}
