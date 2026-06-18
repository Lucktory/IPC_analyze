'use client'

// ============================================================================
// MovimientosModal — wraps MovimientosPanel in modal chrome.
//
// Triggered from the planilla's Movimientos cell (one modal per row). The
// contract detail page embeds MovimientosPanel directly instead — no modal.
// ============================================================================

import { useEffect } from 'react'
import { MovimientosPanel } from './MovimientosPanel'
import { periodLabel } from '@/lib/period'

interface Props {
  open:           boolean
  onClose:        () => void
  contractId:     string
  /** YYYY-MM-01 */
  period:         string
  /** Shown in the header: propietario / inquilino names so the encargada knows which row she's editing. */
  contractLabel?: string
}

export function MovimientosModal({ open, onClose, contractId, period, contractLabel }: Props) {
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
      <div className="relative bg-white border border-gray-300 rounded shadow-xl w-full max-w-[760px] max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-3 border-b border-gray-200 sticky top-0 bg-white z-10 flex items-center justify-between">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">
              Movimientos · {periodLabel(period)}
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
        <div className="px-5 py-4">
          <MovimientosPanel contractId={contractId} period={period} />
        </div>
      </div>
    </div>
  )
}
