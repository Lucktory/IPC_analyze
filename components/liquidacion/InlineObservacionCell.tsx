'use client'

// ============================================================================
// InlineObservacionCell — compact planilla cell for the Observaciones
// reminders. Shows, at a glance:
//   • rojo dot + count  = ítems activos este mes (feed the transfer)
//   • negro dot + count = pendientes (se cargan solos al mes que corresponda)
//   • the net effect on this month's transfer, when non-zero
// Click → ObservacionesModal (the full two-row list + add/edit/cancel).
//
// Replaces the old single note + single adjustment. The old manual adjustment
// still counts additively upstream (queries.ts) so no data is lost; new
// entries are contract_events shown here.
// ============================================================================

import { useState } from 'react'
import { fmtMoney } from '@/lib/format'
import { ObservacionesModal } from './ObservacionesModal'
import type { EventsSummary } from '@/lib/contract/events-bulk'

interface Props {
  contractId:     string
  /** YYYY-MM-01 */
  period:         string
  summary:        EventsSummary | null
  /** Propietario / inquilino names for the modal header. */
  contractLabel?: string
}

export function InlineObservacionCell({ contractId, period, summary, contractLabel }: Props) {
  const [open, setOpen] = useState(false)

  const esteMes    = summary?.esteMes.length ?? 0
  const pendientes = summary?.pendientes.length ?? 0
  const net        = summary?.adjustmentEffect ?? 0
  const hasAny     = esteMes > 0 || pendientes > 0

  return (
    <>
      <button
        type="button"
        data-editing={open ? '' : undefined}
        onClick={() => setOpen(true)}
        title="Observaciones / arreglos / ajustes — tocá para ver y cargar"
        className="w-full text-left px-1 -mx-1 rounded hover:bg-blue-50 transition-colors flex flex-col gap-0.5"
      >
        {hasAny ? (
          <>
            <span className="flex items-center gap-2 text-[10.5px] leading-tight">
              {esteMes > 0 && (
                <span className="inline-flex items-center gap-1 text-danger" title={`${esteMes} este mes`}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-danger" />{esteMes}
                </span>
              )}
              {pendientes > 0 && (
                <span className="inline-flex items-center gap-1 text-ink" title={`${pendientes} pendiente(s)`}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-ink" />{pendientes}
                </span>
              )}
            </span>
            {net !== 0 && (
              <span className={`text-[11px] tabular-nums font-medium ${net > 0 ? 'text-success' : 'text-danger'}`}>
                {net > 0 ? '+' : ''}{fmtMoney(net)}
              </span>
            )}
          </>
        ) : (
          <span className="text-[10px] text-slate-dark hover:text-ink italic">+ Nota</span>
        )}
      </button>

      <ObservacionesModal
        open={open}
        onClose={() => setOpen(false)}
        contractId={contractId}
        period={period}
        summary={summary}
        contractLabel={contractLabel}
      />
    </>
  )
}
