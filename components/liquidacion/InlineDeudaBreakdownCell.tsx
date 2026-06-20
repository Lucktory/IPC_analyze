'use client'

// ============================================================================
// InlineDeudaBreakdownCell — planilla cell that shows the Deuda value AND
// opens the global DeudaBreakdownPanel in a portal popover when clicked.
//
// When the contract has no debt this period AND no carryover, the cell
// stays as a plain non-clickable dash to avoid noise — there's nothing
// to expand. Click only kicks in when there's actually something to show.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingPopover } from './useFloatingPopover'
import { fmtMoney } from '@/lib/format'
import { DeudaBreakdownPanel } from '@/components/shared/DeudaBreakdownPanel'
import type { DeudaBreakdown } from '@/lib/liquidacion/deuda-breakdown'

interface Props {
  /** Current-period deuda — kept as a separate prop because the row builder
   *  already computes it via the existing path. `breakdown.deudaCurrent`
   *  should equal this value; we trust this prop to drive the cell label. */
  deuda:     number
  breakdown: DeudaBreakdown | null
}

export function InlineDeudaBreakdownCell({ deuda, breakdown }: Props) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const rect = useFloatingPopover({ open, anchor: buttonRef.current, minWidth: 380 })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const display = deuda > 0
    ? <span className="text-danger font-medium tabular-nums">{fmtMoney(deuda)}</span>
    : <span className="text-gray-400 tabular-nums">—</span>

  // Show clickable affordance only when there's something to expand:
  // either a non-zero current debt, a non-zero carryover, or estimable intereses.
  const hasBreakdown =
    !!breakdown && (
      breakdown.deudaCurrent > 0 ||
      breakdown.deudaCarryover > 0 ||
      (breakdown.lateInterestEnabled && breakdown.interesesEstimado > 0)
    )

  if (!hasBreakdown) {
    return <span className="block w-full text-right tabular-nums">{display}</span>
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-editing={open ? '' : undefined}
        onClick={() => setOpen(true)}
        title="Tocá para ver el desglose de la deuda"
        className="w-full text-right hover:bg-blue-50 transition-colors px-0"
      >
        {display}
      </button>

      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />
          <div
            style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
            className="bg-white border border-gray-300 rounded shadow-lg p-4"
            onClick={e => e.stopPropagation()}
          >
            <DeudaBreakdownPanel breakdown={breakdown!} />
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
