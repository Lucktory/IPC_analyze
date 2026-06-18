'use client'

// ============================================================================
// InlineMovimientosCell — planilla cell that summarises a contract's
// cashflow for the period and opens the editable Movimientos modal on click.
//
// Displays the NET amount (IN - OUT) as the headline number. Click anywhere
// on the cell → modal with the full per-row breakdown (Fecha / Mov. / Monto /
// Razón) where the encargada can add, edit, or delete rows.
// ============================================================================

import { useState } from 'react'
import { fmtMoney } from '@/lib/format'
import { MovimientosModal } from '@/components/shared/MovimientosModal'

interface Props {
  contractId:     string
  period:         string
  /** Sum of IN amounts for the period (RENT_IN + recuperos + OTHER_IN + …). */
  totalIn:        number
  /** Sum of OUT amounts for the period (COMMISSION_OUT + OTHER_OUT + …). */
  totalOut:       number
  /** Total number of transactions for the contract+period. Drives the badge. */
  count:          number
  /** Reused in the modal header so the encargada knows which row she's editing. */
  contractLabel?: string
}

export function InlineMovimientosCell({
  contractId, period, totalIn, totalOut, count, contractLabel,
}: Props) {
  const [open, setOpen] = useState(false)

  const net = totalIn - totalOut
  const hasMovements = count > 0
  const netClass = net > 0 ? 'text-success' : net < 0 ? 'text-danger' : 'text-gray-500'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={hasMovements
          ? `Ver y editar ${count} movimiento${count === 1 ? '' : 's'}. Entradas: ${fmtMoney(totalIn)} · Salidas: ${fmtMoney(totalOut)}.`
          : 'Sin movimientos en el período — tocá para agregar.'}
        className="w-full text-right hover:bg-blue-50 transition-colors px-0"
      >
        {hasMovements ? (
          <span className="block">
            <span className={`tabular-nums ${netClass}`}>{fmtMoney(net)}</span>
            <span className="block text-[9.5px] text-gray-500 leading-tight">
              {count} mov.
            </span>
          </span>
        ) : (
          <span className="tabular-nums text-gray-400">—</span>
        )}
      </button>

      <MovimientosModal
        open={open}
        onClose={() => setOpen(false)}
        contractId={contractId}
        period={period}
        contractLabel={contractLabel}
      />
    </>
  )
}
