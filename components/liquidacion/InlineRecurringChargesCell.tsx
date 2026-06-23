'use client'

// ============================================================================
// InlineRecurringChargesCell — planilla cell for the Recargos column.
//
// Visual:
//   • Cell shows the total expected amount + a status dot at the right.
//       ● green = every typed charge has a matching transaction this period
//       ● red   = at least one typed charge is missing its transaction
//       (no dot) = contract has no charges configured, or none are typed
//   • Click → portal popover with the RecurringChargesPanel breakdown.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingPopover } from './useFloatingPopover'
import { fmtMoney } from '@/lib/format'
import { RecurringChargesPanel } from '@/components/shared/RecurringChargesPanel'
import type { RecurringChargesSummary } from '@/lib/contract/recurring-charges-bulk'

interface Props {
  contractId: string
  period:     string
  summary:    RecurringChargesSummary | null
}

export function InlineRecurringChargesCell({ contractId, period, summary }: Props) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const rect = useFloatingPopover({ open, anchor: buttonRef.current, minWidth: 360 })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // No charges configured → muted dash, not clickable.
  if (!summary || summary.lines.length === 0) {
    return (
      <span
        className="block w-full text-right tabular-nums text-gray-400"
        title="Sin recargos cargados — agregalos desde la página del contrato"
      >
        —
      </span>
    )
  }

  const dotClass =
    summary.status === 'complete' ? 'bg-success' :
    summary.status === 'missing'  ? 'bg-danger'  :
                                    null  // 'na' → no dot

  const tooltipParts: string[] = []
  tooltipParts.push(`Total esperado: ${fmtMoney(summary.totalExpected)}`)
  if (summary.status === 'complete') tooltipParts.push('✓ todos los recargos registrados')
  if (summary.status === 'missing')  tooltipParts.push(`⚠ ${summary.typedCount - summary.recordedCount} sin registrar`)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-editing={open ? '' : undefined}
        onClick={() => setOpen(true)}
        title={tooltipParts.join(' · ') + ' — click para ver el desglose'}
        className="w-full text-right hover:bg-blue-50 transition-colors px-0 inline-flex items-center justify-end gap-1.5"
      >
        <span className="tabular-nums text-ink">{fmtMoney(summary.totalExpected)}</span>
        {dotClass && (
          <span className={`inline-block w-2 h-2 rounded-full ${dotClass}`} aria-hidden />
        )}
      </button>

      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />
          <div
            style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
            className="bg-white border border-gray-300 rounded shadow-lg p-4"
            onClick={e => e.stopPropagation()}
          >
            <RecurringChargesPanel
              summary={summary}
              period={period}
              editHref={`/contratos/${contractId}`}
            />
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
