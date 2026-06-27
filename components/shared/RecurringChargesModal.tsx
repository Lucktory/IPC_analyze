'use client'

// ============================================================================
// RecurringChargesModal — manage a contract's recargos directly from the
// planilla without leaving it. Combines two views in one modal:
//
//   • TOP    — RecurringChargesPanel (read-only breakdown for THIS period
//              with ✓ / ⚠ per-line status)
//   • BOTTOM — RecurringChargesEditor (add / edit / remove rows; persists
//              immediately via the existing recurring-charges actions)
//
// Same modal chrome as MovimientosModal so the encargada gets the same
// pattern across the planilla. Replaces the previous read-only popover
// that forced her to leave for /contratos/[id] to make any changes.
// ============================================================================

import { useEffect } from 'react'
import { periodLabel } from '@/lib/period'
import { RecurringChargesPanel } from './RecurringChargesPanel'
import { RecurringChargesEditor } from '@/components/contract/RecurringChargesEditor'
import type { RecurringChargesSummary } from '@/lib/contract/recurring-charges-bulk'

interface Props {
  open:          boolean
  onClose:       () => void
  contractId:    string
  /** YYYY-MM-01 */
  period:        string
  /** Pre-built summary for this period (from the planilla row). Drives the
   *  read-only top section. The editor below mutates the underlying data;
   *  router.refresh() inside the editor re-fetches the row so this prop
   *  reflects fresh state on the next render. */
  summary:       RecurringChargesSummary | null
  /** Used to show "alquiler $X + recargos = $Y" context in the editor. */
  currentRent:   number
  /** Optional: propietario / inquilino names for the modal header. */
  contractLabel?: string
}

export function RecurringChargesModal({
  open, onClose, contractId, period, summary, currentRent, contractLabel,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1100] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
      />
      {/* text-left resets the text-align inherited from the planilla's
          right-aligned Recargos <td> (this modal is rendered inside that cell,
          not portaled), which otherwise right-aligns every label and paragraph. */}
      <div className="relative bg-white border border-gray-300 rounded shadow-xl w-full max-w-[880px] max-h-[92vh] overflow-y-auto text-left">
        <div className="px-5 py-3 border-b border-gray-200 sticky top-0 bg-white z-10 flex items-center justify-between">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">
              Recargos · {periodLabel(period)}
            </h2>
            {contractLabel && (
              <p className="text-[11.5px] text-gray-500 mt-0.5">{contractLabel}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-ink transition-colors text-[18px] leading-none px-2 py-1"
          >×</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Top: read-only breakdown for this period (status of every line). */}
          {summary && summary.lines.length > 0 && (
            <section>
              <RecurringChargesPanel summary={summary} period={period} />
            </section>
          )}

          {/* Bottom: editable list (add / edit / remove rows). */}
          <section>
            <p className="label-cap text-slate mb-2">
              {summary && summary.lines.length > 0 ? 'Modificar lista' : 'Cargar recargos'}
            </p>
            <RecurringChargesEditor
              contractId={contractId}
              currentRent={currentRent}
              currentPeriod={period}
            />
          </section>
        </div>
      </div>
    </div>
  )
}
