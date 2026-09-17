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
import { useState } from 'react'
import { useBusyTransition } from '@/components/shell/NavProgress'
import { InlineNumberCell } from './InlineNumberCell'
import { InlineSelectCell } from './InlineSelectCell'
import { InlineDateRangeCell } from './InlineDateRangeCell'
import {
  updateContractLfa,
  updateContractExpensas,
  updateContractVigencia,
  upsertCellTransaction,
  setLiquidacionStatus,
  type CellDestination,
} from '@/lib/contract/inline-field-actions'
import { updateCommissionPctAndRecalc, setCommissionBankCell, setOtrosCell } from '@/lib/transaction/actions'
import type { LiquidacionStatus } from '@/lib/liquidacion/queries'
import { expectedCommission } from '@/lib/liquidacion/thresholds'
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
    // Matches generateCommissionForPeriod exactly because both call the same
    // function now, rather than both restating the formula and hoping.
    const expected = expectedCommission(ingresos, n, includesIva)
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
  expectedRent, maxPlausibleComm, accent = '',
}: {
  contractId:        string
  period:            string
  typeCode:          string
  destination?:      CellDestination
  value:             number
  cobrado:           boolean
  label?:            string
  expectedRent?:     number
  maxPlausibleComm?: number
  /** Text color class applied when value > 0 (e.g. the green neto column). */
  accent?:           string
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
      onSave={(n) =>
        // Commission goes through the single writer so a bank edit MOVES the one
        // row (no second COMMISSION_OUT, no doubled ADMI). OTROS goes through its
        // own single writer so the cell only ever touches its own row and can
        // never overwrite an itemised salida logged in Movimientos. Everything
        // else keeps the generic per-cell upsert.
        typeCode === 'COMMISSION_OUT' && destination
          ? setCommissionBankCell(contractId, period, destination, n)
          : typeCode === 'OTHER_OUT'
            ? setOtrosCell(contractId, period, n)
            : upsertCellTransaction(contractId, period, typeCode, n, null, label ?? null, destination)}
      displayClassName={value > 0 && accent ? accent : cobrado ? 'text-ink' : 'text-slate'}
      title={label}
      validate={validate}
    />
  )
}

// ── Estado: elegir el estado, no avanzarlo ─────────────────────────────────
//
// Hasta el 2026-09-17 esto era un ciclo: cada clic pasaba al estado siguiente.
// Alejandro lo toco sin querer en su primer minuto con el sistema y la
// liquidacion quedo en "Enviada" sin que se hubiera mandado ningun mail. Para
// devolverla a Borrador habia que pasarla por "Pagada", o sea que la unica forma
// de deshacer el error era marcar una rendicion como cobrada. En una pantalla de
// plata, el camino de vuelta no puede ser peor que el error.
//
// Y un "Enviada" falso es justo lo que el flujo de mail evita a proposito: abrir
// Gmail y cancelar NO marca enviada, pregunta antes. Un clic de mas en la
// pastilla lo conseguia igual.
//
// Ahora el clic abre las tres opciones y cualquiera queda a un clic de
// distancia, incluida la vuelta atras.
const STATUS_OPTIONS: { value: LiquidacionStatus; label: string; pill: string }[] = [
  { value: 'draft', label: 'Borrador', pill: 'bg-warn/15 text-warn' },
  { value: 'sent',  label: 'Enviada',  pill: 'bg-success/15 text-success' },
  { value: 'paid',  label: 'Pagada',   pill: 'bg-info/15 text-info' },
]

export function EditableStatusCell({
  contractId, landlordId, period, status,
}: {
  contractId: string
  landlordId: string
  period:     string
  status:     LiquidacionStatus
}) {
  const [pending, startTransition] = useBusyTransition()
  const [error, setError] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useState<LiquidacionStatus | null>(null)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const shown   = optimistic ?? status
  const current = STATUS_OPTIONS.find(o => o.value === shown) ?? STATUS_OPTIONS[0]

  function choose(next: LiquidacionStatus) {
    setOpen(false)
    if (next === shown) return
    const prev = shown
    setOptimistic(next)
    setError(null)
    startTransition(async () => {
      const res = await setLiquidacionStatus(contractId, landlordId, period, next)
      if (!res.ok) {
        setOptimistic(prev === status ? null : prev)
        setError(res.error ?? 'Error al cambiar estado')
      } else {
        router.refresh()
      }
    })
  }

  return (
    <span className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={pending}
        title={`Estado: ${current.label} · Click para elegir otro`}
        className={`inline-flex items-center transition-transform hover:scale-105 ${pending ? 'opacity-60' : ''}`}
      >
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${current.pill}`}>
          {current.label}
        </span>
      </button>
      {error && <span className="text-[9px] text-danger" title={error}>!</span>}

      {open && (
        <>
          {/* Capa para cerrar tocando afuera. Sin esto el menu queda abierto y
              tapando la fila de al lado en una grilla de 20 columnas. */}
          <span
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <span className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 flex flex-col gap-0.5 p-1 rounded bg-paper border border-line shadow-card">
            {STATUS_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => choose(o.value)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-opacity ${o.pill} ${
                  o.value === shown ? 'ring-1 ring-ink/30' : 'opacity-70 hover:opacity-100'
                }`}
              >
                {o.label}
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  )
}
