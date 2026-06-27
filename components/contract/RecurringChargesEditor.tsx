'use client'

// ============================================================================
// RecurringChargesEditor — full editor for contract.contract_recurring_charges.
//
// Replaces the single-row AblSurchargeEditor with an N-rows list. Sits on
// /contratos/[id]. Each row: label (free-text + dropdown suggestions),
// amount, optional recupero_type_code, active toggle, remove button. Plus
// an inline "+ Agregar recargo" form below the list.
//
// Per Alejandro 2026-06-20: each contract may need many recargos (ABL,
// THU, Camuzzi, Tasa de Limpieza, Edesur, AySA, etc.). Categories live in
// the editor as suggested labels; free-text fallback for anything new.
// ============================================================================

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fmtMoney } from '@/lib/format'
import {
  listRecurringCharges,
  addRecurringCharge,
  updateRecurringCharge,
  deleteRecurringCharge,
  type RecurringCharge,
} from '@/lib/contract/recurring-charges'

interface Props {
  contractId:   string
  /** Shown in the "cobro esperado" preview to give context against the rent. */
  currentRent:  number
  /** Current period ('YYYY-MM-01') — the default "desde" for newly added
   *  charges, so a new recargo starts now instead of painting past months red. */
  currentPeriod: string
}

interface DraftLine {
  label:             string
  amount:            string
  recuperoTypeCode:  string
  /** 'YYYY-MM' (the <input type="month"> value). */
  startPeriod:       string
  intervalMonths:    number
}

const SUGGESTED_LABELS = ['ABL', 'THU', 'Tasa de Limpieza', 'Camuzzi (gas)', 'Edesur (luz)', 'AySA', 'Seguro', 'Otro'] as const

// Billing cadences offered in the "Cada" dropdown. interval_months value → label.
const INTERVAL_OPTIONS: Array<{ v: number; l: string }> = [
  { v: 1,  l: 'Mensual' },
  { v: 2,  l: 'Bimestral' },
  { v: 3,  l: 'Trimestral' },
  { v: 6,  l: 'Semestral' },
  { v: 12, l: 'Anual' },
]

/** 'YYYY-MM-01' → 'YYYY-MM' for <input type="month">; '' when null. */
const toMonthInput   = (period: string | null): string => (period ? period.slice(0, 7) : '')
/** 'YYYY-MM' → 'YYYY-MM-01'; null when empty (= "siempre", legacy). */
const fromMonthInput = (m: string): string | null => (m ? `${m}-01` : null)

// Friendly labels for the "Tipo" dropdown — the technical RECUPERO_*_IN code
// stays as the stored value (it's what the cobro auto-check matches against),
// but the encargada sees a plain name.
const SUGGESTED_TYPE_CODES: Array<{ code: string; label: string }> = [
  { code: '',                       label: 'Sin tipo' },
  { code: 'RECUPERO_ABL_IN',        label: 'ABL' },
  { code: 'RECUPERO_METROGAS_IN',   label: 'Gas' },
  { code: 'RECUPERO_EDESUR_IN',     label: 'Luz' },
  { code: 'RECUPERO_AYSA_IN',       label: 'Agua' },
  { code: 'RECUPERO_OTRO_IN',       label: 'Otro' },
]

const emptyDraft = (startMonth: string): DraftLine => ({
  label: '', amount: '', recuperoTypeCode: '', startPeriod: startMonth, intervalMonths: 1,
})

export function RecurringChargesEditor({ contractId, currentRent, currentPeriod }: Props) {
  const [charges, setCharges] = useState<RecurringCharge[]>([])
  const [loaded, setLoaded]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [draft, setDraft]     = useState<DraftLine>(emptyDraft(toMonthInput(currentPeriod)))
  const [pending, startTx]    = useTransition()
  const router = useRouter()

  useEffect(() => {
    setLoaded(false)
    startTx(async () => {
      const rows = await listRecurringCharges(contractId)
      setLoaded(true)
      setCharges(rows)
    })
  }, [contractId])

  function refetch() {
    startTx(async () => {
      const rows = await listRecurringCharges(contractId)
      setCharges(rows)
    })
  }

  function handleAdd() {
    setError(null)
    const amount = Number(draft.amount)
    if (!draft.label.trim()) { setError('Etiqueta vacía.'); return }
    if (!isFinite(amount) || amount <= 0) { setError('El monto debe ser mayor a 0.'); return }
    startTx(async () => {
      const res = await addRecurringCharge({
        contractId,
        label:            draft.label.trim(),
        amount,
        recuperoTypeCode: draft.recuperoTypeCode || null,
        startPeriod:      fromMonthInput(draft.startPeriod),
        intervalMonths:   draft.intervalMonths,
      })
      if (!res.ok) { setError(res.error); return }
      setDraft(emptyDraft(toMonthInput(currentPeriod)))
      refetch()
      router.refresh()
    })
  }

  function patchRow(id: string, patch: Partial<{ label: string; amount: number; recuperoTypeCode: string | null; active: boolean; startPeriod: string | null; intervalMonths: number }>) {
    setCharges(prev => prev.map(r => r.id === id ? { ...r, ...patch } as RecurringCharge : r))
    startTx(async () => {
      const res = await updateRecurringCharge(id, patch)
      if (!res.ok) { setError(res.error); refetch(); return }
      router.refresh()
    })
  }

  function removeRow(id: string) {
    if (!window.confirm('¿Eliminar este recargo?')) return
    startTx(async () => {
      const res = await deleteRecurringCharge(id)
      if (!res.ok) { setError(res.error); return }
      setCharges(prev => prev.filter(r => r.id !== id))
      router.refresh()
    })
  }

  const totalActive = charges.filter(c => c.active).reduce((s, c) => s + c.amount, 0)

  return (
    <div className="bg-paper border border-line rounded p-4">
      <div className="mb-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <p className="label-cap text-slate">Recargos mensuales</p>
          {charges.length > 0 && (
            <p className="text-[12px] text-slate-dark">
              Total activo: <strong className="text-ink tabular-nums">{fmtMoney(totalActive)}</strong>
              <span className="text-gray-400 text-[10.5px] ml-2">sobre alquiler {fmtMoney(currentRent)}</span>
            </p>
          )}
        </div>
        <p className="text-[12px] text-slate mt-1">
          Cargos fijos que se suman al alquiler (ABL, THU, Camuzzi, etc.). Indicá
          desde qué mes se cobran y cada cuánto (mensual, bimestral…). Aparecen en
          la columna <strong className="text-ink">Recargos</strong> de la planilla
          con un puntito verde cuando el cobro está cargado o rojo cuando falta —
          solo en los meses que corresponde.
        </p>
      </div>

      {error && (
        <div className="mb-2 text-[11.5px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">{error}</div>
      )}

      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-[12.5px] border-collapse min-w-[700px]">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-600">
            <tr className="border-b border-gray-200">
              <th className="text-left  px-2 py-1.5 font-medium w-[130px]">Etiqueta</th>
              <th className="text-right px-2 py-1.5 font-medium w-[92px]">Monto</th>
              <th className="text-left  px-2 py-1.5 font-medium">Tipo</th>
              <th className="text-left  px-2 py-1.5 font-medium w-[130px]">Desde</th>
              <th className="text-left  px-2 py-1.5 font-medium w-[100px]">Cada</th>
              <th className="text-center px-2 py-1.5 font-medium w-[52px]">Activo</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {!loaded && (
              <tr><td colSpan={7} className="p-3 text-center text-gray-500 italic">Cargando…</td></tr>
            )}
            {loaded && charges.length === 0 && (
              <tr><td colSpan={7} className="p-3 text-center text-gray-500 italic">Sin recargos cargados.</td></tr>
            )}
            {charges.map(r => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-cream/30">
                <td className="px-2 py-1">
                  <input
                    type="text"
                    defaultValue={r.label}
                    list="recurring-charge-labels"
                    onBlur={e => {
                      const v = e.target.value.trim()
                      if (v && v !== r.label) patchRow(r.id, { label: v })
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    className="w-full bg-transparent text-[12.5px] outline-none focus:bg-cream/40 rounded px-1"
                  />
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
                  <select
                    value={r.recuperoTypeCode ?? ''}
                    onChange={e => patchRow(r.id, { recuperoTypeCode: e.target.value || null })}
                    className="w-full bg-transparent text-[11.5px] outline-none focus:bg-cream/40 rounded px-1"
                  >
                    {SUGGESTED_TYPE_CODES.map(t => (
                      <option key={t.code} value={t.code}>{t.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <input
                    type="month"
                    defaultValue={toMonthInput(r.startPeriod)}
                    onBlur={e => {
                      const v = fromMonthInput(e.target.value)
                      if (v !== r.startPeriod) patchRow(r.id, { startPeriod: v })
                    }}
                    title="Desde qué mes se cobra (vacío = siempre)"
                    className="w-full bg-transparent text-[11.5px] outline-none focus:bg-cream/40 rounded px-1"
                  />
                </td>
                <td className="px-2 py-1">
                  <select
                    value={r.intervalMonths}
                    onChange={e => patchRow(r.id, { intervalMonths: Number(e.target.value) })}
                    className="w-full bg-transparent text-[11.5px] outline-none focus:bg-cream/40 rounded px-1"
                  >
                    {INTERVAL_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={e => patchRow(r.id, { active: e.target.checked })}
                    className="h-3.5 w-3.5 accent-ink"
                  />
                </td>
                <td className="px-1 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    title="Eliminar"
                    disabled={pending}
                    className="text-gray-400 hover:text-danger transition-colors px-1 disabled:opacity-50"
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <datalist id="recurring-charge-labels">
        {SUGGESTED_LABELS.map(l => <option key={l} value={l} />)}
      </datalist>

      {/* Add new */}
      <div className="mt-3 bg-cream/40 border border-gray-200 rounded p-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-600 font-medium mb-1.5">
          + Agregar recargo
        </p>
        <div className="grid grid-cols-[130px_92px_minmax(110px,1fr)_130px_100px_auto] gap-2 items-center">
          <input
            type="text"
            list="recurring-charge-labels"
            value={draft.label}
            onChange={e => setDraft(s => ({ ...s, label: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="ABL, THU, Camuzzi..."
            className="h-8 px-2 rounded border border-gray-300 bg-white text-[12.5px] outline-none focus:border-info"
          />
          <input
            type="number"
            value={draft.amount}
            onChange={e => setDraft(s => ({ ...s, amount: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Monto"
            step="0.01"
            className="h-8 px-2 rounded border border-gray-300 bg-white text-[12.5px] text-right tabular-nums outline-none focus:border-info"
          />
          <select
            value={draft.recuperoTypeCode}
            onChange={e => setDraft(s => ({ ...s, recuperoTypeCode: e.target.value }))}
            className="h-8 px-2 rounded border border-gray-300 bg-white text-[12px] outline-none focus:border-info"
          >
            {SUGGESTED_TYPE_CODES.map(t => (
              <option key={t.code} value={t.code}>{t.label}</option>
            ))}
          </select>
          <input
            type="month"
            value={draft.startPeriod}
            onChange={e => setDraft(s => ({ ...s, startPeriod: e.target.value }))}
            title="Desde qué mes se cobra"
            className="h-8 px-2 rounded border border-gray-300 bg-white text-[12px] outline-none focus:border-info"
          />
          <select
            value={draft.intervalMonths}
            onChange={e => setDraft(s => ({ ...s, intervalMonths: Number(e.target.value) }))}
            title="Cada cuánto se cobra"
            className="h-8 px-2 rounded border border-gray-300 bg-white text-[12px] outline-none focus:border-info"
          >
            {INTERVAL_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
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
