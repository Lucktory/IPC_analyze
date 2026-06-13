'use client'

// ============================================================================
// InlineObservacionCell — click-to-edit OBSERVACIÓN cell.
//
// Two fields edited together: free-text notes + a signed numeric adjustment
// (positive = extra paid to landlord, negative = extra deducted from
// transferencia). Both persist to the liquidaciones row via the same upsert.
//
// Display state (collapsed):
//   - free notes line on top (text-slate-dark)
//   - signed adjustment colored chip on the second line:
//       + → text-success ("+$500")
//       − → text-danger  ("−$1.000")
//
// Edit state (expanded):
//   - textarea for notes (2 rows, autosize on focus)
//   - number input for adjustment with explicit + / − sign
//   - Save button + Cancel link
//
// We don't save on blur here because the textarea blurs on tab to the
// adjustment input — implicit save would corrupt half-edited state.
// Explicit Save / Cancel buttons keep the contract clear.
// ============================================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertLiquidacionObservacion } from '@/lib/liquidacion/actions'
import { fmtMoney } from '@/lib/format'

interface Props {
  contractId:       string
  landlordId:       string
  period:           string
  initialNotes:     string | null
  initialAdjustment: number
}

export function InlineObservacionCell({
  contractId, landlordId, period, initialNotes, initialAdjustment,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [notes, setNotes]     = useState(initialNotes ?? '')
  const [adj, setAdj]         = useState<string>(initialAdjustment ? initialAdjustment.toString() : '')
  const [error, setError]     = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router    = useRouter()
  const taRef     = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) taRef.current?.focus()
  }, [editing])

  function save() {
    const parsedAdj = adj.trim() === '' ? 0 : Number(adj)
    if (!isFinite(parsedAdj)) {
      setError('El ajuste no es numérico.')
      return
    }
    if (notes === (initialNotes ?? '') && parsedAdj === initialAdjustment) {
      setEditing(false)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await upsertLiquidacionObservacion(
        contractId, landlordId, period, notes, parsedAdj,
      )
      if (!res.ok) {
        setError(res.error)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  function cancel() {
    setNotes(initialNotes ?? '')
    setAdj(initialAdjustment ? initialAdjustment.toString() : '')
    setEditing(false)
    setError(null)
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
        <textarea
          ref={taRef}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') cancel()
          }}
          disabled={pending}
          rows={2}
          placeholder="Notas…"
          className="w-full px-1 py-0.5 text-[11px] border border-ink rounded bg-paper outline-none text-ink resize-none"
        />
        <input
          type="number"
          step="0.01"
          value={adj}
          onChange={e => setAdj(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter')  save()
            if (e.key === 'Escape') cancel()
          }}
          disabled={pending}
          placeholder="±$ ajuste"
          className="w-full px-1 py-0.5 text-[11px] border border-line rounded bg-paper outline-none focus:border-ink text-ink tabular-nums"
        />
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={cancel} disabled={pending} className="text-[10px] text-slate hover:text-ink transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={pending} className="text-[10px] font-medium text-ink bg-cream-2 hover:bg-cream px-2 py-0.5 rounded">
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        {error && <span className="text-[10px] text-danger" title={error}>{error}</span>}
      </div>
    )
  }

  const hasNote = !!initialNotes?.trim()
  const hasAdj  = initialAdjustment !== 0
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Tocá para editar observación / ajuste"
      className="w-full text-left px-1 -mx-1 rounded hover:bg-cream-2 transition-colors flex flex-col gap-0.5"
    >
      {hasNote ? (
        <span className="text-slate-dark text-[11px] truncate" title={initialNotes ?? ''}>
          {initialNotes}
        </span>
      ) : !hasAdj ? (
        <span className="text-slate/60">—</span>
      ) : null}
      {hasAdj && (
        <span className={`text-[11px] tabular-nums font-medium ${initialAdjustment > 0 ? 'text-success' : 'text-danger'}`}>
          {initialAdjustment > 0 ? '+' : ''}{fmtMoney(initialAdjustment)}
        </span>
      )}
    </button>
  )
}
