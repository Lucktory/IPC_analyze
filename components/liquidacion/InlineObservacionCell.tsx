'use client'

// ============================================================================
// InlineObservacionCell — compact planilla cell for the Observaciones
// reminders. Shows, at a glance:
//   • rojo dot + count  = ítems de este mes (a cobrar + cobrado)
//   • negro dot + count = pendientes (se cargan solos al mes que corresponda)
//   • cobrado   = lo confirmado, que entra en el recibo (color por signo)
//   • a cobrar  = de este mes, sin confirmar (rojo apagado — no suma)
//   • pendiente = de meses futuros (negro apagado — no suma)
// Click → ObservacionesModal (la lista completa + agregar/editar/confirmar).
//
// Replaces the old single note + single adjustment. The old manual adjustment
// still counts additively upstream (queries.ts) so no data is lost; new
// entries are contract_events shown here.
// ============================================================================

import { useState } from 'react'
import { fmtSignedMoney } from '@/lib/format'
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
  const cobrado    = summary?.adjustmentEffect    ?? 0   // confirmed → in the receipt
  const aCobrar    = summary?.esteMesACobrarTotal ?? 0   // este mes, unconfirmed
  const pendTotal  = summary?.pendientesTotal     ?? 0   // future months
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
            {(cobrado !== 0 || aCobrar !== 0 || pendTotal !== 0) && (
              <span className="flex items-center gap-2 text-[11px] tabular-nums font-medium leading-tight">
                {/* Cobrado: confirmed → enters the receipt (colored by sign). */}
                {cobrado !== 0 && (
                  <span className={cobrado > 0 ? 'text-success' : 'text-danger'} title="Cobrado — entra en el recibo">
                    {fmtSignedMoney(cobrado)}
                  </span>
                )}
                {/* A cobrar: due this month, not confirmed → muted red, no suma. */}
                {aCobrar !== 0 && (
                  <span className="text-danger/60 italic" title="A cobrar este mes — todavía no suma">
                    {fmtSignedMoney(aCobrar)}
                  </span>
                )}
                {/* Pendiente: future months → muted ink, no suma. */}
                {pendTotal !== 0 && (
                  <span className="text-ink/60 italic" title="Pendiente — se carga el mes que corresponda">
                    {fmtSignedMoney(pendTotal)}
                  </span>
                )}
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
