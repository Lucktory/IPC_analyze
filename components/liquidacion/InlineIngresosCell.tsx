'use client'

// ============================================================================
// InlineIngresosCell — dynamic Ingresos cell (Phase 6).
//
// Display:   sum of all lines, same as before (so the planilla at a glance
//            still shows one number).
// Editing:   click → popover opens with the per-line breakdown. Each row is:
//              [Tipo dropdown]  [Monto]  [Bank date]  [✏ description]  [🗑]
//            Plus a "+ Agregar concepto" footer for adding a new line.
//
// All edits use the per-line server actions in
// lib/liquidacion/ingresos-line-actions.ts. They run sequentially via
// useTransition; the popover only closes after every pending write
// completes (so optimistic state stays consistent).
// ============================================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useFloatingPopover } from './useFloatingPopover'
import { fmtMoney } from '@/lib/format'
import type { IngresosLine } from '@/lib/liquidacion/queries'
import {
  createIngresosLine,
  updateIngresosLine,
  deleteIngresosLine,
} from '@/lib/liquidacion/ingresos-line-actions'
import { INGRESOS_LINE_TYPES } from '@/lib/liquidacion/ingresos-line-types'

// Human-readable labels for the dropdown — taken straight from the seeded
// transaction_types.label values so the popover and the dropdown agree.
const TYPE_LABELS: Record<string, string> = {
  RENT_IN:               'Alquiler',
  EXPENSAS_IN:           'Expensas',
  LATE_FEE_IN:           'Mora / recargo',
  RECUPERO_ABL_IN:       'Recupero ABL',
  RECUPERO_AYSA_IN:      'Recupero AySA',
  RECUPERO_METROGAS_IN:  'Recupero Metrogas / Gas',
  RECUPERO_EDESUR_IN:    'Recupero Edesur / Luz',
  RECUPERO_OTRO_IN:      'Recupero otro servicio',
  UTILITY_REFUND_IN:     'Reintegro servicios',
  OTHER_IN:              'Otro ingreso',
}

interface Props {
  contractId:  string
  period:      string
  lines:       IngresosLine[]
  total:       number          // sum of lines.amount (precomputed by the grid)
  /** When true, the row's bank_date has been set — display switches to ink. */
  cobrado:     boolean
  /** Inline alert: a warning for aumento próximo, etc. */
  upcomingAdjustment?: { days: number } | null

  // ── Phase 9C: scope the popover to a subset of transaction types.
  //    Used to split the single Ingresos cell into Alquiler (RENT_IN only)
  //    and Extras (everything else). If unset, the popover behaves as
  //    before — all IN types available.
  /** Restrict the popover to JUST these type codes (whitelist). */
  onlyTypes?:    readonly string[]
  /** Hide these type codes from the popover (blacklist). */
  excludeTypes?: readonly string[]
  /** Display label inside the popover header. */
  popoverTitle?: string
  /** Default new-line type code (must be in onlyTypes if provided). */
  defaultNewLineType?: string
  /** Optional pre-rendered display node (override default sum formatting).
   *  MUST be a serializable React node — never a function. Passing a
   *  function across the server→client boundary throws an opaque RSC
   *  render error whose message is stripped in production. The grid
   *  pre-builds the +/- formatted node and passes it as a node. */
  displayOverride?: React.ReactNode
  /** Optional title attribute (tooltip) on the cell button. */
  buttonTitle?: string
  /** Extra Tailwind classes for the cell button background (e.g., orange
   *  for aumento próximo). */
  cellBgClass?: string
}

interface DraftLine {
  id?:           string       // undefined for "new, unsaved"
  typeCode:      string
  amount:        string        // string so the input can hold partials
  description:   string
  bankDate:      string
}

function lineFromExisting(l: IngresosLine): DraftLine {
  return {
    id:          l.transactionId,
    typeCode:    l.typeCode,
    amount:      l.amount.toString(),
    description: l.description ?? '',
    bankDate:    l.bankDate ?? '',
  }
}

const emptyNewLine = (): DraftLine => ({
  typeCode:    'RECUPERO_ABL_IN',
  amount:      '',
  description: '',
  bankDate:    '',
})

export function InlineIngresosCell({
  contractId, period, lines, total, cobrado, upcomingAdjustment,
  onlyTypes, excludeTypes, popoverTitle, defaultNewLineType,
  displayOverride, buttonTitle, cellBgClass,
}: Props) {
  const [open, setOpen]   = useState(false)
  const [drafts, setDrafts] = useState<DraftLine[]>([])
  const [error, setError]   = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const router    = useRouter()

  const rect = useFloatingPopover({ open, anchor: buttonRef.current, minWidth: 460 })

  // Filter lines to the popover's scope (Phase 9C). The grid passes the
  // FULL ingresosLines array; the cell decides which to show based on
  // onlyTypes / excludeTypes. Cell button's `total` prop is already
  // pre-filtered upstream.
  const filteredLines = lines.filter(l => {
    if (onlyTypes && !onlyTypes.includes(l.typeCode))     return false
    if (excludeTypes && excludeTypes.includes(l.typeCode)) return false
    return true
  })

  // Allowed type codes for the dropdown.
  const availableTypes = INGRESOS_LINE_TYPES.filter(t => {
    if (onlyTypes && !onlyTypes.includes(t))     return false
    if (excludeTypes && excludeTypes.includes(t)) return false
    return true
  })

  // On open: hydrate drafts from the filtered subset.
  useEffect(() => {
    if (open) {
      setDrafts(filteredLines.map(lineFromExisting))
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lines])

  function close() {
    setOpen(false)
  }

  // Run a sequence of server actions: each promise-returning callback fires
  // after the previous one resolves. Stops on first error.
  async function runSequence(steps: Array<() => Promise<{ ok: boolean; error: string | null }>>): Promise<{ ok: boolean; error?: string | null }> {
    for (const step of steps) {
      const res = await step()
      if (!res.ok) return res
    }
    return { ok: true }
  }

  function save() {
    setError(null)
    startTransition(async () => {
      // Diff existing-lines (props) vs drafts:
      //   • draft with id missing from existing → impossible (we only add via "Agregar")
      //   • draft with id in existing → maybe update
      //   • existing id missing from drafts → delete
      //   • draft without id → insert
      // Diff against FILTERED lines so the Extras popover doesn't accidentally
      // delete RENT_IN rows (and vice versa). Lines outside the filter scope
      // belong to the sibling cell and stay untouched.
      const existingById = new Map(filteredLines.map(l => [l.transactionId, l]))
      const draftIds = new Set(drafts.filter(d => d.id).map(d => d.id!))

      const steps: Array<() => Promise<{ ok: boolean; error: string | null }>> = []

      // Deletions first (no dependency).
      for (const l of filteredLines) {
        if (!draftIds.has(l.transactionId)) {
          steps.push(() => deleteIngresosLine(l.transactionId, contractId))
        }
      }

      // Then updates + inserts.
      for (const d of drafts) {
        const amt = Number(d.amount)
        if (!isFinite(amt) || amt <= 0) {
          return setError('Hay líneas con monto vacío o inválido.')
        }
        if (d.id) {
          const orig = existingById.get(d.id)
          if (!orig) continue
          // Skip if nothing changed.
          if (orig.typeCode === d.typeCode &&
              orig.amount   === amt &&
              (orig.description ?? '') === d.description &&
              (orig.bankDate    ?? '') === d.bankDate) continue
          steps.push(() => updateIngresosLine({
            transactionId: d.id!,
            contractId,
            amount:        amt,
            typeCode:      d.typeCode,
            bankDate:      d.bankDate || null,
            description:   d.description || null,
          }))
        } else {
          steps.push(() => createIngresosLine({
            contractId,
            period,
            typeCode:    d.typeCode,
            amount:      amt,
            bankDate:    d.bankDate || null,
            description: d.description || null,
          }))
        }
      }

      if (steps.length === 0) {
        close()
        return
      }
      const res = await runSequence(steps)
      if (!res.ok) {
        setError(res.error ?? 'Error al guardar las líneas.')
        return
      }
      close()
      router.refresh()
    })
  }

  function addLine() {
    // New lines default to the caller-provided type when set (e.g., Alquiler
    // popover defaults to RENT_IN). Otherwise fall back to the first
    // available type in the filtered list, then to RECUPERO_ABL_IN as a
    // last resort.
    const fallback = availableTypes[0] ?? 'RECUPERO_ABL_IN'
    const next: DraftLine = {
      ...emptyNewLine(),
      typeCode: defaultNewLineType && availableTypes.includes(defaultNewLineType as any)
        ? defaultNewLineType
        : fallback,
    }
    setDrafts(prev => [...prev, next])
  }
  function patchLine(idx: number, patch: Partial<DraftLine>) {
    setDrafts(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d))
  }
  function removeLine(idx: number) {
    setDrafts(prev => prev.filter((_, i) => i !== idx))
  }

  // Live total inside the popover (sum of current drafts).
  const liveTotal = drafts.reduce((s, d) => s + (isFinite(Number(d.amount)) ? Number(d.amount) : 0), 0)

  // Background tint on the cell (aumento próximo highlight). Only applied
  // when no cellBgClass override is passed (Phase 9C: Alquiler cell still
  // gets the aumento highlight; Extras cell stays neutral).
  const cellStyle: React.CSSProperties | undefined =
    !cellBgClass && upcomingAdjustment
      ? { backgroundColor: 'rgba(243,156,18,0.12)' }
      : undefined

  const defaultTitle = upcomingAdjustment
    ? `Ingresos · ⚠ Aumento de alquiler en ${upcomingAdjustment.days} días`
    : (filteredLines.length > 1
        ? `${filteredLines.length} conceptos — click para ver / editar`
        : (total > 0 ? 'Click para ver / editar' : 'Click para registrar'))

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-editing={open ? '' : undefined}
        onClick={() => setOpen(true)}
        title={buttonTitle ?? defaultTitle}
        style={cellStyle}
        className={`w-full text-right px-0 hover:bg-blue-50 transition-colors tabular-nums truncate font-medium ${cobrado ? 'text-ink' : 'text-slate'} ${cellBgClass ?? ''}`}
      >
        {displayOverride !== undefined
          ? displayOverride
          : (total !== 0 ? fmtMoney(total) : '—')}
        {displayOverride === undefined && filteredLines.length > 1 && (
          <span className="block text-[9px] text-slate normal-case font-normal">
            {filteredLines.length} conceptos
          </span>
        )}
      </button>

      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[999]" onClick={save} />
          <div
            style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
            className="bg-white border border-gray-300 rounded shadow-lg"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <span className="font-display text-[13px] font-medium text-ink">{popoverTitle ?? 'Ingresos del período'}</span>
              <span className="text-[10px] text-gray-500 italic">click afuera = guardar · Esc = cancelar</span>
            </div>

            <div className="max-h-[340px] overflow-y-auto">
              {drafts.length === 0 && (
                <p className="px-3 py-6 text-[12px] text-gray-500 italic text-center">
                  Sin líneas. Tocá <strong>+ Agregar concepto</strong> abajo para registrar el primer cobro.
                </p>
              )}
              {drafts.map((d, i) => (
                <div key={d.id ?? `new-${i}`} className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
                  <select
                    value={d.typeCode}
                    onChange={e => patchLine(i, { typeCode: e.target.value })}
                    className="h-8 px-1.5 text-[12px] border border-gray-300 rounded bg-white outline-none focus:border-info min-w-0 flex-1"
                  >
                    {availableTypes.map(t => (
                      <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="any"
                    value={d.amount}
                    onChange={e => patchLine(i, { amount: e.target.value })}
                    placeholder="$"
                    className="h-8 w-28 px-2 text-[12px] border border-gray-300 rounded bg-white outline-none focus:border-info text-right tabular-nums"
                  />
                  <input
                    type="date"
                    value={d.bankDate}
                    onChange={e => patchLine(i, { bankDate: e.target.value })}
                    className="h-8 px-1.5 text-[11px] border border-gray-300 rounded bg-white outline-none focus:border-info"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    title="Eliminar línea"
                    className="h-8 w-7 text-gray-400 hover:text-danger transition-colors flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button
                type="button"
                onClick={addLine}
                className="text-[12px] text-info hover:underline font-medium"
              >
                + Agregar concepto
              </button>
              <span className="text-[12px] text-ink font-display font-medium tabular-nums">
                TOTAL: {fmtMoney(liveTotal)}
              </span>
            </div>

            {error && (
              <div className="px-3 py-2 text-[11.5px] text-danger bg-danger/10 border-t border-danger/30">
                {error}
              </div>
            )}

            <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="px-2 py-1 text-[11px] text-gray-600 hover:text-ink"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="px-2.5 py-1 text-[11px] bg-ink text-paper rounded font-medium hover:opacity-90 disabled:opacity-60"
              >
                {pending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
