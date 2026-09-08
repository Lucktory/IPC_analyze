'use client'

// ============================================================================
// ObservacionesModal — the two-row reminders surface Alejandro specified.
//
//   • ESTE MES (rojo)  — corresponde este mes. Each item starts "a cobrar";
//     only what's confirmed COBRADO enters the owner's receipt (Alejandro's
//     rule: rojo means it's due, not that it already happened).
//   • PENDIENTES (negro) — items for a later period; carry forward automatically.
//
// Each item = one contract_events row (arreglo/ajuste). Add / edit / confirmar
// / cancel via the events actions; a confirmed (cobrado) red item's owner-
// effect is summed into the transfer adjustment upstream (queries.ts), so this
// modal only edits data — router.refresh() re-reads the row and totals follow.
//
// "Cuándo": ESTE MES → applies_to_period = current period (rojo now);
//           MES QUE VIENE → applies_to_period = next period (negro now, rojo
//           next), which is the day-20/day-10 deferral.
// ============================================================================

import { useEffect, useState } from 'react'
import { useBusyTransition } from '@/components/shell/NavProgress'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { fmtSignedMoney } from '@/lib/format'
import { periodLabel, shiftPeriod } from '@/lib/period'
import {
  EVENT_KIND, EVENT_PARTY, EVENT_STATUS,
  transferEffectOf, honorarioGross, type ContractEvent, type EventParty,
} from '@/lib/contract/events-types'
import type { EventsSummary } from '@/lib/contract/events-bulk'
import {
  addContractEvent, addHonorarioInstallments, payoffHonorarioBalance,
  updateContractEvent, cancelContractEvent,
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
/** The single non-zero magnitude stored on an event (0 for note-only items). */
const magnitudeOf = (e: ContractEvent): number =>
  e.amountLandlord > 0 ? e.amountLandlord : e.amountTenant
/** An event is confirmed (cobrado) once its status is 'applied'. */
const isCobrado = (e: ContractEvent): boolean => e.status === EVENT_STATUS.APPLIED

// Confirmation labels — Alejandro's vocabulary. Centralized so a wording change
// (e.g. "Hecho") is a one-line edit rather than a scatter of string literals.
const LABEL_COBRADO   = 'Cobrado'
const LABEL_A_COBRAR  = 'A cobrar'
const LABEL_EN_RECIBO = 'En el recibo'

export function ObservacionesModal({ open, onClose, contractId, period, summary, contractLabel }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [honDraft, setHonDraft] = useState({ description: '', amount: '', cuotas: '1', includesIva: false })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTx] = useBusyTransition()
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const allEsteMes    = summary?.esteMes ?? []
  const allPendientes = summary?.pendientes ?? []
  // Honorarios are AGENCY income, not owner-transfer arreglos. Split them out so
  // they get their own section and never mix into the receipt/transfer math
  // (which upstream already ignores non-adjustment kinds anyway).
  const esteMes    = allEsteMes.filter(e => e.kind !== EVENT_KIND.HONORARIOS)
  const pendientes = allPendientes.filter(e => e.kind !== EVENT_KIND.HONORARIOS)
  const honorarios = [...allEsteMes, ...allPendientes].filter(e => e.kind === EVENT_KIND.HONORARIOS)
  const hasFutureHonorarios = honorarios.some(e => e.appliesToPeriod != null && e.appliesToPeriod > period)

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

  function handleAddHonorario() {
    setError(null)
    const amount = Number(honDraft.amount)
    const cuotas = Number(honDraft.cuotas)
    if (!(amount > 0)) { setError('Ingresá el monto de los honorarios.'); return }
    startTx(async () => {
      // Honorarios = agency income, split into cuotas (one HONORARIOS event per
      // month; future cuotas surface as reminders). NOT an ADJUSTMENT_KIND, so
      // it never enters the owner's receipt/transfer.
      const res = await addHonorarioInstallments({
        contractId,
        total:       amount,
        cuotas:      cuotas >= 1 ? cuotas : 1,
        startPeriod: period,
        includesIva: honDraft.includesIva,
        description: honDraft.description.trim() || null,
      })
      if (!res.ok) { setError(res.error); return }
      setHonDraft({ description: '', amount: '', cuotas: '1', includesIva: false })
      router.refresh()
    })
  }

  function handlePayoffHonorarios() {
    setError(null)
    startTx(async () => {
      const res = await payoffHonorarioBalance(contractId, period)
      if (!res.ok) { setError(res.error); return }
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

  const cobradoEsteMes = summary?.adjustmentEffect    ?? 0   // confirmed → in the receipt
  const aCobrarEsteMes = summary?.esteMesACobrarTotal ?? 0   // pending   → shown, not summed
  const esteMesFooter  = (() => {
    const parts: string[] = []
    if (cobradoEsteMes !== 0) parts.push(`${LABEL_EN_RECIBO}: ${fmtSignedMoney(cobradoEsteMes)}`)
    if (aCobrarEsteMes !== 0) parts.push(`${LABEL_A_COBRAR}: ${fmtSignedMoney(aCobrarEsteMes)} (no suma)`)
    return parts.length ? parts.join('  ·  ') : null
  })()

  // Portal to <body>: this cell lives in a sticky-left <td>, whose stacking
  // context + opaque background otherwise clip the modal's left edge. Rendering
  // at document.body escapes the table entirely (same pattern as the other
  // inline planilla cells). Guarded by `open` + client-only 'use client', so
  // document is always defined by the time we get here.
  if (typeof document === 'undefined') return null

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1100] flex items-center justify-center px-4 text-left">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" />
      <div className="relative bg-paper border border-line rounded shadow-xl w-full max-w-[720px] max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-3 border-b border-line sticky top-0 bg-paper z-10 flex items-center justify-between">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">Observaciones · {periodLabel(period)}</h2>
            {contractLabel && <p className="text-[12.5px] text-slate mt-0.5">{contractLabel}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-slate hover:text-ink text-[18px] leading-none px-2 py-1">×</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <ReminderSection
            title="Este mes" tone="rojo"
            items={esteMes} onPatch={patch} onRemove={remove}
            emptyText="Nada este mes."
            footer={esteMesFooter}
          />
          <ReminderSection
            title="Pendientes" tone="negro"
            items={pendientes} onPatch={patch} onRemove={remove}
            emptyText="Sin pendientes."
            footer="Se cargan solos al mes que corresponda."
          />

          {/* Add */}
          <div className="bg-cream/40 border border-line rounded p-2">
            <p className="text-[11px] uppercase tracking-wider text-slate-dark font-medium mb-1.5">+ Agregar</p>
            <div className="grid grid-cols-[1fr_110px_110px_110px_auto] gap-2 items-center">
              <input
                type="text" value={draft.description}
                onChange={e => setDraft(s => ({ ...s, description: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                placeholder="Arreglo, ajuste…"
                className="h-8 px-2 rounded border border-line bg-paper text-[13.5px] outline-none focus:border-info"
              />
              <select
                value={draft.party}
                onChange={e => setDraft(s => ({ ...s, party: e.target.value as EventParty }))}
                className="h-8 px-2 rounded border border-line bg-paper text-[13px] outline-none focus:border-info"
              >
                <option value={EVENT_PARTY.LANDLORD}>Al dueño</option>
                <option value={EVENT_PARTY.TENANT}>Al inquilino</option>
              </select>
              <input
                type="number" value={draft.amount} step="0.01" min={0}
                onChange={e => setDraft(s => ({ ...s, amount: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                placeholder="Monto"
                className="h-8 px-2 rounded border border-line bg-paper text-[13.5px] text-right tabular-nums outline-none focus:border-info"
              />
              <select
                value={draft.cuando}
                onChange={e => setDraft(s => ({ ...s, cuando: e.target.value as Draft['cuando'] }))}
                title="Cuándo se descuenta/suma"
                className="h-8 px-2 rounded border border-line bg-paper text-[13px] outline-none focus:border-info"
              >
                <option value="este">Este mes</option>
                <option value="proximo">Mes que viene</option>
              </select>
              <button
                type="button" onClick={handleAdd} disabled={pending}
                className="h-8 px-3 rounded bg-info text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-60"
              >Agregar</button>
            </div>
          </div>

          {/* Honorarios — ingreso de la inmobiliaria (una sola vez, al renovar
              o hacer un contrato nuevo). No entra en la liquidación del dueño. */}
          <HonorariosSection
            items={honorarios}
            draft={honDraft}
            onDraft={setHonDraft}
            onAdd={handleAddHonorario}
            onRemove={remove}
            onPayoff={handlePayoffHonorarios}
            hasFuture={hasFutureHonorarios}
            pending={pending}
          />

          {error && <div className="text-[12.5px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">{error}</div>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Honorarios section — agency income (ingreso de la inmobiliaria) ─────────
// Separate from arreglos/ajustes: honorarios are the inmobiliaria's one-time
// fee (renovación / nuevo contrato) and never touch the owner's receipt.
interface HonDraft { description: string; amount: string; cuotas: string; includesIva: boolean }

function HonorariosSection({
  items, draft, onDraft, onAdd, onRemove, onPayoff, hasFuture, pending,
}: {
  items:     ContractEvent[]
  draft:     HonDraft
  onDraft:   (d: HonDraft) => void
  onAdd:     () => void
  onRemove:  (id: string) => void
  onPayoff:  () => void
  hasFuture: boolean
  pending:   boolean
}) {
  const total    = Number(draft.amount)
  const cuotas   = Math.max(1, Math.trunc(Number(draft.cuotas)) || 1)
  const perCuota = total > 0 ? total / cuotas : 0
  // Was a hardcoded `n * 1.21` — a sixth copy of the IVA rate. Routed through
  // the canonical helper so this preview and the three totals that consume the
  // saved honorario can never disagree about the rate or its direction.
  const withIva  = (n: number) => honorarioGross(n, draft.includesIva)

  return (
    <section className="border border-info/30 bg-info/5 rounded p-2.5">
      <p className="label-cap text-info mb-1.5 flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-full bg-info" /> Honorarios · ingreso inmobiliaria
      </p>
      {items.length === 0 ? (
        <p className="text-[13px] text-slate italic px-1">Sin honorarios cargados.</p>
      ) : (
        <ul className="space-y-1">
          {items.map(e => {
            const neto = magnitudeOf(e)
            return (
              <li key={e.id} className="flex items-center justify-between gap-2 border-b border-line py-1">
                <span className="text-[13.5px] text-ink truncate min-w-0">{e.description || 'Honorarios'}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {e.includesIva && (
                    <span className="text-[10px] px-1 py-0.5 rounded bg-info/15 text-info" title={`Total con IVA: ${fmtSignedMoney(honorarioGross(neto, true))}`}>+IVA</span>
                  )}
                  <span className="text-[13px] tabular-nums font-medium text-info">{fmtSignedMoney(neto)}</span>
                  <button type="button" onClick={() => onRemove(e.id)} title="Eliminar" className="text-slate hover:text-danger hover:bg-danger/10 rounded text-[20px] leading-none px-2 py-0.5 -my-0.5">×</button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {hasFuture && (
        <button
          type="button" onClick={onPayoff} disabled={pending}
          title="Adelantar todas las cuotas futuras a este mes y cancelarlas (pago anticipado del saldo)"
          className="mt-1.5 text-[12px] text-info hover:underline font-medium disabled:opacity-60"
        >
          → Cobrar saldo restante ahora
        </button>
      )}

      {/* Add: monto total (neto) + cuotas + IVA, then descripción. */}
      <div className="mt-2 space-y-1.5">
        <div className="grid grid-cols-[130px_84px_1fr] gap-2 items-center">
          <input
            type="number" value={draft.amount} step="0.01" min={0}
            onChange={e => onDraft({ ...draft, amount: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') onAdd() }}
            placeholder="Monto (neto)"
            title="Monto total de los honorarios (neto, sin IVA)"
            className="h-8 px-2 rounded border border-info/60 bg-paper text-[13.5px] text-right tabular-nums outline-none focus:border-info"
          />
          <input
            type="number" value={draft.cuotas} step="1" min={1} max={12}
            onChange={e => onDraft({ ...draft, cuotas: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') onAdd() }}
            placeholder="Cuotas"
            title="Cantidad de cuotas (1 = pago único)"
            className="h-8 px-2 rounded border border-line bg-paper text-[13.5px] text-right tabular-nums outline-none focus:border-info"
          />
          <select
            value={draft.includesIva ? '1' : '0'}
            onChange={e => onDraft({ ...draft, includesIva: e.target.value === '1' })}
            className="h-8 px-2 rounded border border-line bg-paper text-[13px] outline-none focus:border-info"
          >
            <option value="0">Sin IVA</option>
            <option value="1">Con IVA 21%</option>
          </select>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
          <input
            type="text" value={draft.description}
            onChange={e => onDraft({ ...draft, description: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') onAdd() }}
            placeholder="Descripción (opcional) — renovación / contrato nuevo"
            className="h-8 px-2 rounded border border-line bg-paper text-[13.5px] outline-none focus:border-info"
          />
          <button
            type="button" onClick={onAdd} disabled={pending}
            className="h-8 px-3 rounded bg-info text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-60"
          >Agregar</button>
        </div>
        {total > 0 && (
          <p className="text-[11.5px] text-slate italic px-0.5">
            {cuotas > 1
              ? `→ ${cuotas} cuotas de ${fmtSignedMoney(perCuota)}${draft.includesIva ? ` (con IVA ${fmtSignedMoney(withIva(perCuota))})` : ''}, desde este mes`
              : `→ pago único${draft.includesIva ? ` · con IVA: ${fmtSignedMoney(withIva(total))}` : ''}`}
          </p>
        )}
      </div>
    </section>
  )
}

// ── One section (rojo / negro) ──────────────────────────────────────────────
function ReminderSection({
  title, tone, items, onPatch, onRemove, emptyText, footer,
}: {
  title:    string
  tone:     'rojo' | 'negro'
  items:    ContractEvent[]
  onPatch:  (id: string, changes: Parameters<typeof updateContractEvent>[1]) => void
  onRemove: (id: string) => void
  emptyText: string
  footer:   string | null
}) {
  const dot = tone === 'rojo' ? 'bg-danger' : 'bg-ink'
  return (
    <section>
      <p className="label-cap text-slate mb-1.5 flex items-center gap-1.5">
        <span className={`inline-block w-2 h-2 rounded-full ${dot}`} /> {title}
      </p>
      {items.length === 0 ? (
        <p className="text-[13px] text-slate italic px-1">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {items.map(e => (
            <ReminderItem key={e.id} event={e} tone={tone} onPatch={onPatch} onRemove={onRemove} />
          ))}
        </ul>
      )}
      {footer && <p className="text-[11.5px] text-slate mt-1 px-1 italic">{footer}</p>}
    </section>
  )
}

// ── One editable item ───────────────────────────────────────────────────────
// Description, payer (dueño/inquilino) and amount are all editable in place.
// Local state seeds from the event; each field commits on blur/change through
// updateContractEvent → router.refresh(). Payer + amount both write the two
// amount columns via `amountsFor`, so the stored shape stays canonical.
function ReminderItem({
  event, tone, onPatch, onRemove,
}: {
  event:    ContractEvent
  tone:     'rojo' | 'negro'
  onPatch:  (id: string, changes: Parameters<typeof updateContractEvent>[1]) => void
  onRemove: (id: string) => void
}) {
  const [desc, setDesc]     = useState(event.description ?? '')
  const [party, setParty]   = useState<EventParty>(partyOf(event))
  const [amount, setAmount] = useState<string>(() => {
    const m = magnitudeOf(event)
    return m ? String(m) : ''
  })

  const txt = tone === 'rojo' ? 'text-danger' : 'text-ink'
  // Live effect from the current (party, amount), through the single sign rule.
  const parsed = Number(amount)
  const safe   = isFinite(parsed) && parsed >= 0 ? parsed : 0
  const { amountLandlord, amountTenant } = amountsFor(party, safe)
  const effect = transferEffectOf(amountLandlord, amountTenant)
  // Confirmation state (rojo only). "A cobrar" is muted and doesn't enter the
  // receipt; "cobrado" is solid and counts. Negro items can't be confirmed yet.
  const confirmed   = isCobrado(event)
  const aCobrar     = tone === 'rojo' && !confirmed
  const effectClass = aCobrar ? 'text-slate italic' : txt

  function commitDescription() {
    const v = desc.trim()
    if (v !== (event.description ?? '')) onPatch(event.id, { description: v || null })
  }
  function commitAmounts(nextParty: EventParty, nextAmount: string) {
    const n = Number(nextAmount)
    if (nextAmount !== '' && (!isFinite(n) || n < 0)) return   // ignore invalid input
    const next = amountsFor(nextParty, isFinite(n) ? n : 0)
    if (next.amountLandlord === event.amountLandlord && next.amountTenant === event.amountTenant) return
    onPatch(event.id, { amountLandlord: next.amountLandlord, amountTenant: next.amountTenant })
  }

  return (
    <li className="grid grid-cols-[1fr_96px_72px_auto] gap-2 items-center border-b border-line py-1">
      <input
        type="text" value={desc}
        onChange={e => setDesc(e.target.value)}
        onBlur={commitDescription}
        placeholder="Descripción"
        className="min-w-0 bg-transparent text-[13.5px] outline-none focus:bg-cream/40 rounded px-1"
      />
      <select
        value={party}
        onChange={e => { const p = e.target.value as EventParty; setParty(p); commitAmounts(p, amount) }}
        className="h-7 px-1.5 rounded border border-line bg-paper text-[12.5px] outline-none focus:border-info"
      >
        <option value={EVENT_PARTY.LANDLORD}>Al dueño</option>
        <option value={EVENT_PARTY.TENANT}>Al inquilino</option>
      </select>
      <input
        type="number" value={amount} step="0.01" min={0}
        onChange={e => setAmount(e.target.value)}
        onBlur={e => commitAmounts(party, e.target.value)}
        placeholder="Monto"
        className="h-7 px-1.5 rounded border border-line bg-paper text-[13px] text-right tabular-nums outline-none focus:border-info"
      />
      <div className="flex items-center gap-2 justify-end">
        <span className={`text-[12px] tabular-nums font-medium ${effectClass} whitespace-nowrap`}>
          {fmtSignedMoney(effect)}
          {tone === 'negro' && event.appliesToPeriod && (
            <span className="text-[11px] text-slate ml-1">· {periodLabel(event.appliesToPeriod)}</span>
          )}
        </span>
        {tone === 'rojo' && (
          <button
            type="button"
            onClick={() => onPatch(event.id, { status: confirmed ? EVENT_STATUS.PENDING : EVENT_STATUS.APPLIED })}
            title={confirmed ? 'Marcar como a cobrar' : 'Marcar como cobrado (entra al recibo)'}
            className={
              confirmed
                ? 'text-[11px] px-1.5 py-0.5 rounded bg-success/10 border border-success/40 text-success whitespace-nowrap'
                : 'text-[11px] px-1.5 py-0.5 rounded border border-line text-slate hover:border-success hover:text-success whitespace-nowrap'
            }
          >
            {confirmed ? `✓ ${LABEL_COBRADO}` : LABEL_A_COBRAR}
          </button>
        )}
        <button type="button" onClick={() => onRemove(event.id)} title="Eliminar" className="text-slate hover:text-danger hover:bg-danger/10 rounded text-[20px] leading-none px-2 py-0.5 -my-0.5">×</button>
      </div>
    </li>
  )
}
