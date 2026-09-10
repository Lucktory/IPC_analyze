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
  const [popoverEl, setPopoverEl] = useState<HTMLElement | null>(null)
  const rect = useFloatingPopover({ open, anchor: buttonRef.current, popover: popoverEl, minWidth: 380 })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Deuda arrastrada de meses anteriores. Pedido de Alejandro (2026-09-10):
  // "deberia haber un simbolico chiquito arriba de la misma celda... por
  // ejemplo con un signo (+)... para que te avise que hay mas deuda hacia
  // atras". El desglose ya existia; lo que faltaba era el aviso — la celda se
  // veia igual tuviera o no deuda vieja detras, asi que no habia motivo para
  // hacerle click.
  const carryover    = breakdown?.deudaCarryover ?? 0
  const hasCarryover = carryover > 0

  const amount = deuda > 0
    ? <span className="text-danger font-medium tabular-nums">{fmtMoney(deuda)}</span>
    : <span className="text-slate tabular-nums">—</span>

  // El (+) va arriba a la derecha del monto del mes. Se muestra incluso cuando
  // el mes corriente esta al dia (deuda = 0): justamente ese es el caso donde
  // la deuda vieja pasaba desapercibida.
  const display = hasCarryover
    ? (
      <span className="inline-flex items-start gap-px">
        {amount}
        <span className="text-[10px] leading-[1.1] font-bold text-danger select-none">+</span>
      </span>
    )
    : amount

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
        title={hasCarryover
          ? `Además debe ${fmtMoney(carryover)} de meses anteriores — tocá para ver el detalle`
          : 'Tocá para ver el desglose de la deuda'}
        className="w-full text-right hover:bg-info/10 transition-colors px-0"
      >
        {display}
      </button>

      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />
          <div
            ref={setPopoverEl} style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
            className="bg-paper border border-line rounded shadow-lg p-4"
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
