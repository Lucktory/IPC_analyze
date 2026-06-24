'use client'

// ============================================================================
// InlineRecurringChargesCell — planilla cell for the Recargos column.
//
// Click → opens the RecurringChargesModal: status breakdown for this period
// on top, full editor below. The encargada never has to leave the planilla
// to manage recargos. Same pattern as the Movs cell + MovimientosModal.
//
// Visual:
//   • Total amount + dot when the contract has charges configured:
//       ● verde  = every typed charge has a matching transaction this period
//       ● rojo   = at least one typed charge is missing its transaction
//       (no dot when status='na': only untyped charges, can't auto-check)
//   • Empty state shows "+ Cargar" instead of a dead "—" so the affordance
//     to add the first recargo is right there in the cell. Per Alejandro
//     2026-06-20 — Recargos behaves like Movs (managed inline), not like
//     Deuda (view-only popover).
// ============================================================================

import { useState } from 'react'
import { fmtMoney } from '@/lib/format'
import { RecurringChargesModal } from '@/components/shared/RecurringChargesModal'
import type { RecurringChargesSummary } from '@/lib/contract/recurring-charges-bulk'

interface Props {
  contractId:     string
  period:         string
  summary:        RecurringChargesSummary | null
  /** Used by the modal's editor to show "alquiler + recargos = total" */
  currentRent:    number
  /** Propietario / inquilino names for the modal header. */
  contractLabel?: string
}

export function InlineRecurringChargesCell({
  contractId, period, summary, currentRent, contractLabel,
}: Props) {
  const [open, setOpen] = useState(false)

  const hasLines = !!summary && summary.lines.length > 0

  const dotClass = hasLines && summary
    ? summary.status === 'complete' ? 'bg-success' :
      summary.status === 'missing'  ? 'bg-danger'  :
                                      null
    : null

  const tooltipParts: string[] = []
  if (hasLines && summary) {
    tooltipParts.push(`Total esperado: ${fmtMoney(summary.totalExpected)}`)
    if (summary.status === 'complete') tooltipParts.push('✓ todos los recargos registrados')
    if (summary.status === 'missing')  tooltipParts.push(`⚠ ${summary.typedCount - summary.recordedCount} sin registrar`)
    tooltipParts.push('Click para ver / editar')
  } else {
    tooltipParts.push('Sin recargos cargados — click para agregar')
  }

  return (
    <>
      <button
        type="button"
        data-editing={open ? '' : undefined}
        onClick={() => setOpen(true)}
        title={tooltipParts.join(' · ')}
        className="w-full text-right hover:bg-blue-50 transition-colors px-0 inline-flex items-center justify-end gap-1.5"
      >
        {hasLines && summary ? (
          <>
            <span className="tabular-nums text-ink">{fmtMoney(summary.totalExpected)}</span>
            {dotClass && (
              <span className={`inline-block w-2 h-2 rounded-full ${dotClass}`} aria-hidden />
            )}
          </>
        ) : (
          <span className="text-[10px] text-slate-dark hover:text-ink italic">
            + Cargar
          </span>
        )}
      </button>

      <RecurringChargesModal
        open={open}
        onClose={() => setOpen(false)}
        contractId={contractId}
        period={period}
        summary={summary}
        currentRent={currentRent}
        contractLabel={contractLabel}
      />
    </>
  )
}
