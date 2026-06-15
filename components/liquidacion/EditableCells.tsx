'use client'

// ============================================================================
// EditableCells — thin client wrappers that bind the per-cell server
// actions to the generic inline editors. Each one accepts the row's ids
// + the current value and renders the matching editor.
//
// Why per-cell wrappers instead of inline closures: the LiquidacionGrid is
// a server component, so it cannot build closures over contractId across
// the RSC boundary. These wrappers do the binding on the client.
// ============================================================================

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { InlineNumberCell } from './InlineNumberCell'
import { InlineSelectCell } from './InlineSelectCell'
import { InlineDateRangeCell } from './InlineDateRangeCell'
import {
  updateContractLfa,
  updateContractExpensas,
  updateContractCommissionPct,
  updateContractVigencia,
  upsertCellTransaction,
  cycleLiquidacionStatus,
  type DestinationCode,
} from '@/lib/contract/inline-field-actions'
import type { LiquidacionStatus } from '@/lib/liquidacion/queries'

const LFA_OPTIONS = [
  { value: 'L',  label: 'L (Lisa)'     },
  { value: 'F',  label: 'F (Flavio)'   },
  { value: 'A',  label: 'A (Alejandro)' },
  { value: 'FL', label: 'FL (Flavio + Lisa)' },
  { value: 'D',  label: 'D (Dorso)'    },
]

// ── LFA ────────────────────────────────────────────────────────────────────
export function EditableLfaCell({ contractId, value }: { contractId: string; value: string | null }) {
  return (
    <InlineSelectCell
      value={value}
      options={LFA_OPTIONS}
      onSave={(next) => updateContractLfa(contractId, next)}
      displayClassName={value ? 'text-ink font-medium' : 'text-slate'}
      title="L/F/A — responsable del contrato"
    />
  )
}

// ── Expensas ───────────────────────────────────────────────────────────────
export function EditableExpensasCell({
  contractId, value, cobrado,
}: { contractId: string; value: number | null; cobrado: boolean }) {
  return (
    <InlineNumberCell
      value={value}
      format="money"
      min={0}
      unit="$"
      onSave={(n) => updateContractExpensas(contractId, n)}
      displayClassName={cobrado ? 'text-ink' : 'text-slate'}
      title="Expensas mensuales del contrato"
    />
  )
}

// ── Pct (commission %) ─────────────────────────────────────────────────────
export function EditableCommissionPctCell({
  contractId, value, cobrado,
}: { contractId: string; value: number; cobrado: boolean }) {
  return (
    <InlineNumberCell
      value={value}
      format="percent"
      min={0}
      max={100}
      unit="%"
      onSave={(n) => updateContractCommissionPct(contractId, n)}
      displayClassName={cobrado ? 'text-ink' : 'text-slate'}
      title="Comisión de administración (% sobre total cobrado)"
    />
  )
}

// ── Vigencia (start_date / end_date) ───────────────────────────────────────
export function EditableVigenciaCell({
  contractId, startDate, endDate,
}: { contractId: string; startDate: string | null; endDate: string | null }) {
  return (
    <InlineDateRangeCell
      startDate={startDate}
      endDate={endDate}
      onSave={(s, e) => updateContractVigencia(contractId, s, e)}
      displayClassName={startDate || endDate ? 'text-slate-dark' : 'text-slate/60'}
      title="Vigencia del contrato"
    />
  )
}

// ── Transaction amount (Ingresos / Otros / ADM Galicia / 50-9 / 51-6) ──────
export function EditableTransactionCell({
  contractId, period, typeCode, destination = null, value, cobrado, label,
}: {
  contractId:  string
  period:      string
  typeCode:    string
  destination?: DestinationCode
  value:       number
  cobrado:     boolean
  label?:      string
}) {
  return (
    <InlineNumberCell
      value={value > 0 ? value : null}
      format="money"
      min={0}
      unit="$"
      onSave={(n) => upsertCellTransaction(contractId, period, typeCode, n, null, label ?? null, destination)}
      displayClassName={cobrado ? 'text-ink' : 'text-slate'}
      title={label}
    />
  )
}

// ── Estado cycle (borrador → enviada → pagada) ─────────────────────────────
export function EditableStatusCell({
  contractId, landlordId, period, status,
}: {
  contractId: string
  landlordId: string
  period:     string
  status:     LiquidacionStatus
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useState<LiquidacionStatus | null>(null)
  const router = useRouter()

  const shown = optimistic ?? status
  const nextStatus = shown === 'draft' ? 'sent' : shown === 'sent' ? 'paid' : 'draft'

  const dotCls =
    shown === 'draft' ? 'bg-gray-400' :
    shown === 'sent'  ? 'bg-success'  :
                        'bg-info'
  const labelCls =
    shown === 'draft' ? 'Borrador'   :
    shown === 'sent'  ? 'Enviada'    :
                        'Pagada'

  function cycle() {
    setOptimistic(nextStatus)
    setError(null)
    startTransition(async () => {
      const res = await cycleLiquidacionStatus(contractId, landlordId, period, shown)
      if (!res.ok) {
        setOptimistic(null)
        setError(res.error ?? 'Error al cambiar estado')
      } else {
        router.refresh()
      }
    })
  }

  return (
    <button
      type="button"
      onClick={cycle}
      disabled={pending}
      title={`Estado: ${labelCls} · Click para pasar a ${
        nextStatus === 'draft' ? 'borrador' : nextStatus === 'sent' ? 'enviada' : 'pagada'
      }`}
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors ${pending ? 'opacity-60' : ''}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${dotCls}`} />
      <span className="text-[10px] text-slate-dark">{labelCls.slice(0, 4)}</span>
      {error && <span className="text-[9px] text-danger" title={error}>!</span>}
    </button>
  )
}
