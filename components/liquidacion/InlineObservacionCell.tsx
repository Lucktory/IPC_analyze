'use client'

// ============================================================================
// InlineObservacionCell — click-to-edit OBSERVACIÓN cell (popover style).
//
// Earlier version used local-state expanded form which left multiple cells
// open simultaneously when she clicked different rows. This version uses
// the shared floating popover hook + click-outside catcher so only one cell
// can ever be open at a time. Closing is automatic when she clicks anywhere
// outside the popover or presses Esc.
//
// Two fields edited together: free-text notes + a signed numeric adjustment.
// Both persist to the liquidaciones row via the same upsert.
//
// Optimistic close: the cell exits edit mode immediately after Guardar, then
// the server call fires in the background. On error the cell reverts and
// shows the error inline on the display button.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { upsertLiquidacionObservacion } from '@/lib/liquidacion/actions'
import { fmtMoney } from '@/lib/format'
import { useFloatingPopover } from './useFloatingPopover'

interface Props {
  contractId:        string
  landlordId:        string
  period:            string
  initialNotes:      string | null
  initialAdjustment: number
}

export function InlineObservacionCell({
  contractId, landlordId, period, initialNotes, initialAdjustment,
}: Props) {
  const [open, setOpen]     = useState(false)
  const [notes, setNotes]   = useState(initialNotes ?? '')
  const [adj, setAdj]       = useState<string>(initialAdjustment ? initialAdjustment.toString() : '')
  const [error, setError]   = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [optimisticNotes, setOptimisticNotes] = useState<string | null>(null)
  const [optimisticAdj,   setOptimisticAdj]   = useState<number | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const router    = useRouter()

  const rect = useFloatingPopover({ open, anchor: buttonRef.current, minWidth: 300 })

  const shownNotes = optimisticNotes ?? initialNotes
  const shownAdj   = optimisticAdj   ?? initialAdjustment

  // Sync local form state from props when opening (so external refreshes
  // don't get lost) and clear any stale error on every open.
  useEffect(() => {
    if (open) {
      setNotes(initialNotes ?? '')
      setAdj(initialAdjustment ? initialAdjustment.toString() : '')
      setError(null)
    }
  }, [open, initialNotes, initialAdjustment])

  // Clear optimistic state once server data catches up.
  useEffect(() => {
    if (optimisticNotes != null && (optimisticNotes === (initialNotes ?? ''))) setOptimisticNotes(null)
    if (optimisticAdj   != null && optimisticAdj   === initialAdjustment)      setOptimisticAdj(null)
  }, [initialNotes, initialAdjustment, optimisticNotes, optimisticAdj])

  function save() {
    const parsedAdj = adj.trim() === '' ? 0 : Number(adj)
    if (!isFinite(parsedAdj)) {
      setError('El ajuste no es numérico.')
      return
    }
    // No-change short-circuit.
    if (notes === (initialNotes ?? '') && parsedAdj === initialAdjustment) {
      setOpen(false)
      return
    }
    setOptimisticNotes(notes)
    setOptimisticAdj(parsedAdj)
    setOpen(false)
    setPending(true)
    setError(null)
    upsertLiquidacionObservacion(contractId, landlordId, period, notes, parsedAdj)
      .then(res => {
        if (!res.ok) {
          setOptimisticNotes(null)
          setOptimisticAdj(null)
          setError(res.error ?? 'Error al guardar')
        } else {
          router.refresh()
        }
      })
      .finally(() => setPending(false))
  }

  function cancel() {
    setNotes(initialNotes ?? '')
    setAdj(initialAdjustment ? initialAdjustment.toString() : '')
    setOpen(false)
    setError(null)
  }

  const hasNote = !!shownNotes?.trim()
  const hasAdj  = shownAdj !== 0

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-editing={open ? '' : undefined}
        onClick={() => setOpen(true)}
        title="Tocá para editar observación / ajuste"
        className={`w-full text-left px-1 -mx-1 rounded hover:bg-blue-50 transition-colors flex flex-col gap-0.5 ${pending ? 'opacity-60' : ''}`}
      >
        {hasNote ? (
          <span className="text-slate-dark text-[11px] truncate" title={shownNotes ?? ''}>
            {shownNotes}
          </span>
        ) : !hasAdj ? (
          <span className="text-slate/60">—</span>
        ) : null}
        {hasAdj && (
          <span className={`text-[11px] tabular-nums font-medium ${shownAdj > 0 ? 'text-success' : 'text-danger'}`}>
            {shownAdj > 0 ? '+' : ''}{fmtMoney(shownAdj)}
          </span>
        )}
        {error && <span className="block text-[9px] text-danger truncate" title={error}>{error}</span>}
      </button>

      {open && rect && createPortal(
        <>
          {/* Click-outside catcher — exact same pattern other popover cells
              use. Clicking anywhere off the popover saves the cell (Excel
              reflex) and closes it. Only ONE popover can be open at a time
              because each cell has its own catcher that closes its own
              popover. */}
          <div className="fixed inset-0 z-[999]" onClick={save} />

          <div
            style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
            className="bg-white border border-gray-300 rounded shadow-lg p-2"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-0.5">Notas</span>
              <textarea
                autoFocus
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { e.preventDefault(); cancel() }
                }}
                rows={3}
                placeholder="Anotación libre…"
                className="w-full px-2 py-1 text-[12px] border border-gray-300 rounded outline-none focus:border-info text-ink resize-none"
              />
            </label>
            <label className="block mt-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-0.5">Ajuste ($)</span>
              <input
                type="number"
                step="any"
                value={adj}
                onChange={e => setAdj(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter')  { e.preventDefault(); save() }
                  if (e.key === 'Escape') { e.preventDefault(); cancel() }
                }}
                placeholder="±$ ajuste (suma o resta de la transferencia)"
                className="w-full h-8 px-2 text-[12px] border border-gray-300 rounded outline-none focus:border-info tabular-nums text-ink"
              />
            </label>
            {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
            <div className="flex items-center justify-end gap-1.5 mt-2">
              <button type="button" onClick={cancel} className="px-2 py-1 text-[11px] text-gray-600 hover:text-ink">Cancelar</button>
              <button type="button" onClick={save} className="px-2 py-1 text-[11px] bg-ink text-paper rounded font-medium hover:opacity-90">Guardar</button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 italic">Enter para guardar · Esc para cancelar · Click afuera = guardar</p>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
