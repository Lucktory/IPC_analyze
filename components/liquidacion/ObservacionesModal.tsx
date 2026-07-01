'use client'

// ============================================================================
// ObservacionesModal — the two-row reminders surface Alejandro specified.
//
//   • ESTE MES (rojo)  — items active this period; they feed the transfer.
//   • PENDIENTES (negro) — items for a later period; carry forward automatically.
//
// Each item = one contract_events row (arreglo/ajuste). Add / edit / cancel
// via the events actions; the red items' owner-effect is summed into the
// transfer adjustment upstream (queries.ts), so this modal only edits data —
// router.refresh() re-reads the row and the totals follow.
//
// "Cuándo": ESTE MES → applies_to_period = current period (rojo now);
//           MES QUE VIENE → applies_to_period = next period (negro now, rojo
//           next), which is the day-20/day-10 deferral.
// ============================================================================

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fmtMoney } from '@/lib/format'
import { periodLabel, shiftPeriod } from '@/lib/period'
import {
  EVENT_KIND, EVENT_PARTY,
  ownerTransferEffect, type ContractEvent, type EventParty,
} from '@/lib/contract/events-types'
import type { EventsSummary } from '@/lib/contract/events-bulk'
import {
  addContractEvent, updateContractEvent, cancelContractEvent,
} from '@/lib/contract/events'

interface Props {
  open:           boolean
  onClose:        () => void
  contractId:     string
  /** YYYY-MM-01 */
  period:         string
  summary:        EventsSummary | null
  contractLabel?: string
}

interface Draft {
  description: string
  party:       EventParty
  amount:      string
  cuando:      'este' | 'proximo'
}
const emptyDraft = (): Draft => ({ description: '', party: EVENT_PARTY.LANDLORD, amount: '', cuando: 'este' })

/** amount_landlord / amount_tenant from a (party, amount) pair. */
function amountsFor(party: EventParty, amount: number): { amountLandlord: number; amountTenant: number } {
  return party === EVENT_PARTY.LANDLORD
    ? { amountLandlord: amount, amountTenant: 0 }
    : { amountLandlord: 0, amountTenant: amount }
}
const partyOf = (e: ContractEvent): EventParty =>
  e.amountTenant > 0 && e.amountLandlord === 0 ? EVENT_PARTY.TENANT : EVENT_PARTY.LANDLORD

export function ObservacionesModal({ open, onClose, contractId, period, summary, contractLabel }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [error, setError] = useState<string | null>(null)
  const [pending, startTx] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const esteMes    = summary?.esteMes ?? []
  const pendientes = summary?.pendientes ?? []

  function handleAdd() {
    setError(null)
    const amount = Number(draft.amount)
    if (!draft.description.trim() && !(amount > 0)) { setError('Cargá una descripción o un monto.'); return }
    if (draft.amount && (!isFinite(amount) || amount < 0)) { setError('El monto debe ser 0 o mayor.'); return }
    const { amountLandlord, amountTenant } = amountsFor(draft.party, isFinite(amount) ? amount : 0)
    startTx(async () => {
      const res = await addContractEvent({
        contractId,
        kind:            EVENT_KIND.ARREGLO,
        description:     draft.description.trim() || null,
        amountLandlord,
        amountTenant,
        appliesToPeriod: draft.cuando === 'proximo' ? shiftPeriod(period, 1) : period,
      })
      if (!res.ok) { setError(res.error); return }
      setDraft(emptyDraft())
      router.refresh()
    })
  }

  function patch(id: string, changes: Parameters<typeof updateContractEvent>[1]) {
    startTx(async () => {
      const res = await updateContractEvent(id, changes)
      if (!res.ok) { setError(res.error); return }
      router.refresh()
    })
  }
  function remove(id: string) {
    if (!window.confirm('¿Eliminar este ítem?')) return
    startTx(async () => {
      const res = await cancelContractEvent(id)
      if (!res.ok) { setError(res.error); return }
      router.refresh()
    })
  }

  const netEsteMes = summary?.adjustmentEffect ?? 0

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1100] flex items-center justify-center px-4 text-left">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" />
      <div className="relative bg-white border border-gray-300 rounded shadow-xl w-full max-w-[720px] max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-3 border-b border-gray-200 sticky top-0 bg-white z-10 flex items-center justify-between">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">Observaciones · {periodLabel(period)}</h2>
            {contractLabel && <p className="text-[11.5px] text-gray-500 mt-0.5">{contractLabel}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-ink text-[18px] leading-none px-2 py-1">×</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <ReminderSection
            title="Este mes" tone="rojo" period={period}
            items={esteMes} onPatch={patch} onRemove={remove}
            emptyText="Nada este mes."
            footer={netEsteMes !== 0 ? `Efecto en la transferencia: ${netEsteMes > 0 ? '+' : ''}${fmtMoney(netEsteMes)}` : null}
          />
          <ReminderSection
            title="Pendientes" tone="negro" period={period}
            items={pendientes} onPatch={patch} onRemove={remove}
            emptyText="Sin pendientes."
            footer="Se cargan solos al mes que corresponda."
          />

          {/* Add */}
          <div className="bg-cream/40 border border-gray-200 rounded p-2">
            <p className="text-[10px] uppercase tracking-wider text-gray-600 font-medium mb-1.5">+ Agregar</p>
            <div className="grid grid-cols-[1fr_110px_110px_110px_auto] gap-2 items-center">
              <input
                type="text" value={draft.description}
                onChange={e => setDraft(s => ({ ...s, description: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                placeholder="Arreglo, ajuste…"
                className="h-8 px-2 rounded border border-gray-300 bg-white text-[12.5px] outline-none focus:border-info"
              />
              <select
                value={draft.party}
                onChange={e => setDraft(s => ({ ...s, party: e.target.value as EventParty }))}
                className="h-8 px-2 rounded border border-gray-300 bg-white text-[12px] outline-none focus:border-info"
              >
                <option value={EVENT_PARTY.LANDLORD}>Al dueño</option>
                <option value={EVENT_PARTY.TENANT}>Al inquilino</option>
              </select>
              <input
                type="number" value={draft.amount} step="0.01" min={0}
                onChange={e => setDraft(s => ({ ...s, amount: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                placeholder="Monto"
                className="h-8 px-2 rounded border border-gray-300 bg-white text-[12.5px] text-right tabular-nums outline-none focus:border-info"
              />
              <select
                value={draft.cuando}
                onChange={e => setDraft(s => ({ ...s, cuando: e.target.value as Draft['cuando'] }))}
                title="Cuándo se descuenta/suma"
                className="h-8 px-2 rounded border border-gray-300 bg-white text-[12px] outline-none focus:border-info"
              >
                <option value="este">Este mes</option>
                <option value="proximo">Mes que viene</option>
              </select>
              <button
                type="button" onClick={handleAdd} disabled={pending}
                className="h-8 px-3 rounded bg-ink text-paper text-[12px] font-medium hover:opacity-90 disabled:opacity-60"
              >Agregar</button>
            </div>
          </div>

          {error && <div className="text-[11.5px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">{error}</div>}
        </div>
      </div>
    </div>
  )
}

// ── One section (rojo / negro) ──────────────────────────────────────────────
function ReminderSection({
  title, tone, period, items, onPatch, onRemove, emptyText, footer,
}: {
  title:    string
  tone:     'rojo' | 'negro'
  period:   string
  items:    ContractEvent[]
  onPatch:  (id: string, changes: Parameters<typeof updateContractEvent>[1]) => void
  onRemove: (id: string) => void
  emptyText: string
  footer:   string | null
}) {
  const dot = tone === 'rojo' ? 'bg-danger' : 'bg-ink'
  const txt = tone === 'rojo' ? 'text-danger' : 'text-ink'
  return (
    <section>
      <p className="label-cap text-slate mb-1.5 flex items-center gap-1.5">
        <span className={`inline-block w-2 h-2 rounded-full ${dot}`} /> {title}
      </p>
      {items.length === 0 ? (
        <p className="text-[12px] text-slate italic px-1">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {items.map(e => {
            const effect = ownerTransferEffect(e)
            return (
              <li key={e.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center border-b border-gray-100 py-1">
                <input
                  type="text" defaultValue={e.description ?? ''}
                  onBlur={ev => { const v = ev.target.value.trim(); if (v !== (e.description ?? '')) onPatch(e.id, { description: v || null }) }}
                  className="bg-transparent text-[12.5px] outline-none focus:bg-cream/40 rounded px-1"
                />
                <span className={`text-[12px] tabular-nums font-medium ${txt}`}>
                  {effect > 0 ? '+' : ''}{fmtMoney(effect)}
                  <span className="text-[10px] text-gray-500 ml-1">
                    {e.amountTenant > 0 ? 'inq.' : 'due.'}
                    {tone === 'negro' && e.appliesToPeriod ? ` · ${periodLabel(e.appliesToPeriod)}` : ''}
                  </span>
                </span>
                <button type="button" onClick={() => onRemove(e.id)} title="Eliminar" className="text-gray-400 hover:text-danger px-1">×</button>
              </li>
            )
          })}
        </ul>
      )}
      {footer && <p className="text-[10.5px] text-slate mt-1 px-1 italic">{footer}</p>}
    </section>
  )
}
