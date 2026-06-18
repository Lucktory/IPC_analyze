'use client'

// ============================================================================
// MovimientosPanel — editable per-contract cashflow table.
//
// Four columns per row: Fecha · Mov. (Entrada/Salida) · Monto · Razón.
// All cells edit-in-place (autosave on blur / Enter). A "+ Agregar movimiento"
// row sits below the table. Direction is mapped to OTHER_IN / OTHER_OUT on
// save — losing granular type info is the intended trade-off for keeping the
// modal a four-field surface (Alejandro's spec).
//
// Used by:
//   • MovimientosModal — wrapped in modal chrome, triggered from the planilla
//   • Contract detail page — embedded as a section, no modal
// ============================================================================

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fmtMoney } from '@/lib/format'
import {
  listMovimientos,
  addMovimiento,
  updateMovimiento,
  deleteMovimiento,
  type Movimiento,
} from '@/lib/transaction/movimientos-actions'

interface Props {
  contractId: string
  /** YYYY-MM-01 — same period the surrounding planilla / contract page is viewing. */
  period:     string
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function MovimientosPanel({ contractId, period }: Props) {
  const [rows, setRows]       = useState<Movimiento[]>([])
  const [loaded, setLoaded]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [pending, startTx]    = useTransition()
  const router = useRouter()

  const [draft, setDraft] = useState({
    bankDate:    todayIso(),
    direction:   'OUT' as 'IN' | 'OUT',
    amount:      '',
    description: '',
  })

  useEffect(() => {
    setLoaded(false)
    startTx(async () => {
      const res = await listMovimientos(contractId, period)
      setLoaded(true)
      if (!res.ok) { setError(res.error); return }
      setRows(res.rows ?? [])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, period])

  function refetch() {
    startTx(async () => {
      const res = await listMovimientos(contractId, period)
      if (res.ok) setRows(res.rows ?? [])
    })
  }

  function handleAdd() {
    const amount = Number(draft.amount)
    if (!isFinite(amount) || amount <= 0) {
      setError('Ingresá un monto mayor a 0.')
      return
    }
    setError(null)
    startTx(async () => {
      const res = await addMovimiento(
        contractId,
        period,
        draft.direction,
        draft.bankDate || null,
        amount,
        draft.description.trim() || null,
      )
      if (!res.ok) { setError(res.error); return }
      setRows(prev => [...prev, res.movimiento!])
      setDraft({ bankDate: todayIso(), direction: 'OUT', amount: '', description: '' })
      router.refresh()
    })
  }

  function patchRow(
    id:    string,
    patch: Partial<{ bankDate: string | null; amount: number; direction: 'IN' | 'OUT'; description: string | null }>,
  ) {
    // Optimistic update + server sync. If the server rejects, refetch to
    // resync rather than guessing what the previous value was.
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } as Movimiento : r))
    setError(null)
    startTx(async () => {
      const res = await updateMovimiento(id, patch)
      if (!res.ok) {
        setError(res.error)
        refetch()
        return
      }
      router.refresh()
    })
  }

  function removeRow(id: string) {
    if (!window.confirm('¿Eliminar este movimiento?')) return
    setError(null)
    startTx(async () => {
      const res = await deleteMovimiento(id)
      if (!res.ok) { setError(res.error); return }
      setRows(prev => prev.filter(r => r.id !== id))
      router.refresh()
    })
  }

  const totalIn  = rows.filter(r => r.direction === 'IN').reduce((s, r) => s + r.amount, 0)
  const totalOut = rows.filter(r => r.direction === 'OUT').reduce((s, r) => s + r.amount, 0)

  return (
    <div>
      {error && (
        <div className="mb-2 text-[11.5px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-[12.5px] border-collapse min-w-[560px]">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-600">
            <tr className="border-b border-gray-200">
              <th className="text-left  px-2 py-1.5 font-medium w-[120px]">Fecha</th>
              <th className="text-left  px-2 py-1.5 font-medium w-[100px]">Mov.</th>
              <th className="text-right px-2 py-1.5 font-medium w-[120px]">Monto</th>
              <th className="text-left  px-2 py-1.5 font-medium">Razón</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {!loaded && (
              <tr><td colSpan={5} className="p-4 text-center text-gray-500 italic">Cargando…</td></tr>
            )}
            {loaded && rows.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-center text-gray-500 italic">No hay movimientos en este período.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-cream/30">
                <td className="px-2 py-1">
                  <input
                    type="date"
                    value={r.bankDate ?? ''}
                    onChange={e => patchRow(r.id, { bankDate: e.target.value || null })}
                    className="w-full bg-transparent text-[12.5px] outline-none focus:bg-cream/40 rounded px-1"
                  />
                </td>
                <td className="px-2 py-1">
                  <select
                    value={r.direction}
                    onChange={e => patchRow(r.id, { direction: e.target.value as 'IN' | 'OUT' })}
                    title={`${r.typeCode} — ${r.typeLabel}`}
                    className={`w-full bg-transparent text-[12.5px] outline-none focus:bg-cream/40 rounded px-1 ${r.direction === 'IN' ? 'text-success' : 'text-danger'}`}
                  >
                    <option value="IN">Entrada</option>
                    <option value="OUT">Salida</option>
                  </select>
                </td>
                <td className="px-2 py-1 text-right">
                  <input
                    type="number"
                    defaultValue={r.amount}
                    step="0.01"
                    onBlur={e => {
                      const v = Number(e.target.value)
                      if (isFinite(v) && v > 0 && v !== r.amount) patchRow(r.id, { amount: v })
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    className="w-full bg-transparent text-[12.5px] outline-none focus:bg-cream/40 rounded px-1 text-right tabular-nums"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    defaultValue={r.description ?? ''}
                    onBlur={e => {
                      const v = e.target.value.trim() || null
                      if (v !== r.description) patchRow(r.id, { description: v })
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    placeholder="(sin descripción)"
                    className="w-full bg-transparent text-[12.5px] outline-none focus:bg-cream/40 rounded px-1"
                  />
                </td>
                <td className="px-1 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    title="Eliminar movimiento"
                    disabled={pending}
                    className="text-gray-400 hover:text-danger transition-colors px-1 disabled:opacity-50"
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200 text-[11.5px]">
              <tr>
                <td colSpan={2} className="px-2 py-1.5 text-gray-600">
                  {rows.length} movimiento{rows.length === 1 ? '' : 's'}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  <div className="text-success">+ {fmtMoney(totalIn)}</div>
                  <div className="text-danger">- {fmtMoney(totalOut)}</div>
                </td>
                <td colSpan={2} className="px-2 py-1.5 text-right text-gray-700 font-medium tabular-nums">
                  Neto: {fmtMoney(totalIn - totalOut)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="mt-3 bg-cream/40 border border-gray-200 rounded p-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-600 font-medium mb-1.5">
          + Agregar movimiento
        </p>
        <div className="grid grid-cols-[120px_100px_120px_1fr_auto] gap-2 items-center">
          <input
            type="date"
            value={draft.bankDate}
            onChange={e => setDraft(s => ({ ...s, bankDate: e.target.value }))}
            className="h-8 px-2 rounded border border-gray-300 bg-white text-[12.5px] outline-none focus:border-info"
          />
          <select
            value={draft.direction}
            onChange={e => setDraft(s => ({ ...s, direction: e.target.value as 'IN' | 'OUT' }))}
            className={`h-8 px-2 rounded border border-gray-300 bg-white text-[12.5px] outline-none focus:border-info ${draft.direction === 'IN' ? 'text-success' : 'text-danger'}`}
          >
            <option value="OUT">Salida</option>
            <option value="IN">Entrada</option>
          </select>
          <input
            type="number"
            value={draft.amount}
            onChange={e => setDraft(s => ({ ...s, amount: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Monto"
            step="0.01"
            className="h-8 px-2 rounded border border-gray-300 bg-white text-[12.5px] text-right tabular-nums outline-none focus:border-info"
          />
          <input
            type="text"
            value={draft.description}
            onChange={e => setDraft(s => ({ ...s, description: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Razón (ej. reparación plomería)"
            className="h-8 px-2 rounded border border-gray-300 bg-white text-[12.5px] outline-none focus:border-info"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className="h-8 px-3 rounded bg-ink text-paper text-[12px] font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}
