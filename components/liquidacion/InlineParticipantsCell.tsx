'use client'

// ============================================================================
// InlineParticipantsCell — multi-owner / multi-tenant editor for the planilla.
//
// Display state: stacked names + percentages (NamesCell pattern), reads
// like Excel at a glance.
//
// Click → popover:
//   • One chip-row per participant: name picker + % input + [×] button.
//   • The [×] button wraps DelayedActionButton(10s, danger). Click once →
//     10-second armed countdown. Click again → cancel. After 10s without
//     a second click, the row is removed from LOCAL STATE (not yet DB).
//   • Σ% pill at top turns green only when sum=100 (via isPctSum100).
//   • "+ Agregar X" adds a row.
//   • "+ Crear nuevo X" inside the EntityCombo opens NewEntityModal —
//     same UX as the contract modal.
//   • "Guardar" commits the whole list to the DB. Cancel discards.
//
// One component, two configs (kind: 'landlord' | 'tenant'). The kind picks
// the labels, the option list, the entity-create flow, and the right
// server action (updateContractLandlords vs updateContractTenants).
//
// All shared primitives come from @/lib/shared and @/components/shared/*
// per the registry rule.
// ============================================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

import { updateContractLandlords } from '@/lib/contract/junction-actions'
import { updateContractTenants } from '@/lib/contract/actions'
import { createLandlordStandalone } from '@/lib/landlord/actions'
import { createTenantStandalone } from '@/lib/tenant/actions'
import type { LandlordOption } from '@/lib/landlord/queries'
import type { TenantOption } from '@/lib/tenant/queries'

import { EntityCombo, SumPill } from '@/components/shared/forms'
import { NamesCell } from '@/components/shared/cells'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'
import { NewEntityModal, type NewEntityFields } from './NewEntityModal'
import { useFloatingPopover } from './useFloatingPopover'

import { isPctSum100, makeRowId, pctSum } from '@/lib/shared'

// Bulk-imported contracts can have contract_landlords / contract_tenants
// rows that each default to 100% — a 2-tenant contract then sums to 200,
// which makes the server's isPctSum100 guard reject any save.
//
// When the popover first opens for such a row, we redistribute the shares
// equally so the encargada can save without manually rebalancing. A small
// yellow note tells her it was auto-balanced and she can adjust.
function rebalanceIfNeeded(
  participants: ReadonlyArray<{ id: string; name: string; pct: number }>,
): { rows: ReadonlyArray<{ id: string; name: string; pct: number }>; rebalanced: boolean } {
  if (participants.length === 0) return { rows: participants, rebalanced: false }
  const sum = pctSum(participants.map(p => p.pct))
  if (Math.abs(sum - 100) <= 0.05) return { rows: participants, rebalanced: false }
  // Equal split, with the rounding residue applied to the first row so the
  // sum is exactly 100. 3-way split → 33.34 + 33.33 + 33.33.
  const n     = participants.length
  const base  = Math.floor((100 / n) * 100) / 100   // e.g. 33.33
  const residue = Math.round((100 - base * n) * 100) / 100
  const rows = participants.map((p, i) => ({
    ...p,
    pct: i === 0 ? +(base + residue).toFixed(2) : base,
  }))
  return { rows, rebalanced: true }
}

interface Participant {
  id:   string
  name: string
  pct:  number
}

interface ChipRow {
  rowId:    string
  pickedId: string | null
  input:    string
  pct:      string
}

interface Props {
  kind:        'landlord' | 'tenant'
  contractId:  string
  /** Initial set of participants (sorted by % desc). */
  initial:     Participant[]
  /** Autocomplete option list for "existing" picks. */
  options:     LandlordOption[] | TenantOption[]
  /** Whether the contract is currently flagged as orphan (missing junction).
   *  Drives the warning tint on the cell button. */
  isOrphan?:   boolean
  orphanReason?: string | null
}

export function InlineParticipantsCell({
  kind,
  contractId,
  initial,
  options: initialOptions,
  isOrphan,
  orphanReason,
}: Props) {
  const [open, setOpen]   = useState(false)
  // Track whether we auto-redistributed shares on load so the popover can
  // tell the encargada (and so she can save without manually doing it).
  const initialRebalance = rebalanceIfNeeded(initial)
  const [rows, setRows]   = useState<ChipRow[]>(() =>
    initialRebalance.rows.map(p => ({ rowId: makeRowId(), pickedId: p.id, input: p.name, pct: String(p.pct) })),
  )
  const [autoBalanced, setAutoBalanced] = useState(initialRebalance.rebalanced)
  const [optionList, setOptionList] = useState(initialOptions)
  useEffect(() => { setOptionList(initialOptions) }, [initialOptions])

  const [error, setError]     = useState<string | null>(null)
  const [pending, startTrans] = useTransition()
  const [creating, setCreating] = useState<{ rowId: string; name: string } | null>(null)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const router    = useRouter()
  const rect = useFloatingPopover({ open, anchor: buttonRef.current, minWidth: 360 })

  // Re-hydrate every time the popover opens so external refreshes
  // (router.refresh after another row edit) propagate in. Also re-run
  // the auto-balance check — the data may have changed.
  useEffect(() => {
    if (open) {
      const r = rebalanceIfNeeded(initial)
      setRows(r.rows.map(p => ({ rowId: makeRowId(), pickedId: p.id, input: p.name, pct: String(p.pct) })))
      setAutoBalanced(r.rebalanced)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  const pcts        = rows.map(r => r.pct)
  const sumOk       = isPctSum100(pcts)
  const entityLabel = kind === 'landlord' ? 'propietario' : 'inquilino'
  const entityLabelPlural = kind === 'landlord' ? 'propietarios' : 'inquilinos'

  function addRow() {
    setRows(prev => [...prev, { rowId: makeRowId(), pickedId: null, input: '', pct: '0' }])
  }
  function removeRow(rowId: string) {
    setRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.rowId !== rowId))
  }
  function patchRow(rowId: string, patch: Partial<ChipRow>) {
    setRows(prev => prev.map(r => r.rowId === rowId ? { ...r, ...patch } : r))
  }

  function handleSave() {
    setError(null)
    if (rows.some(r => !r.pickedId)) {
      setError(`Todos los ${entityLabelPlural} deben estar seleccionados o creados.`)
      return
    }
    if (!sumOk) {
      setError(`Los porcentajes deben sumar 100% (suman ${pctSum(pcts).toFixed(2)}%).`)
      return
    }
    startTrans(async () => {
      const res = kind === 'landlord'
        ? await updateContractLandlords(
            contractId,
            rows.map(r => ({ landlordId: r.pickedId!, ownershipPct: Number(r.pct) })),
          )
        : await updateContractTenants(
            contractId,
            rows.map(r => ({ tenantId:   r.pickedId!, sharePct:     Number(r.pct) })),
          )
      if (!res.ok) {
        setError(res.error ?? 'Error al guardar.')
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  function handleCreateNew(fields: NewEntityFields): Promise<{ ok: boolean; error?: string | null }> {
    if (kind === 'landlord') {
      if (fields.kind !== 'landlord') {
        return Promise.resolve({ ok: false, error: 'Tipo inválido.' })
      }
      return createLandlordStandalone({
        name:       fields.name,
        dniOrCuit:  fields.dniOrCuit || null,
        phone:      fields.phone     || null,
        email:      fields.email     || null,
        notes:      fields.notes     || null,
      }).then(res => {
        if (res.ok && res.id && creating) {
          const id = res.id
          setOptionList(prev => [...prev, { id, name: fields.name }])
          setRows(prev => prev.map(r =>
            r.rowId === creating.rowId ? { ...r, pickedId: id, input: fields.name } : r,
          ))
          setCreating(null)
        }
        return res
      })
    }
    if (fields.kind !== 'tenant') {
      return Promise.resolve({ ok: false, error: 'Tipo inválido.' })
    }
    return createTenantStandalone({
      name:  fields.name,
      dni:   fields.dni   || null,
      phone: fields.phone || null,
      email: fields.email || null,
    }).then(res => {
      if (res.ok && res.id && creating) {
        const id = res.id
        setOptionList(prev => [...prev, { id, name: fields.name }])
        setRows(prev => prev.map(r =>
          r.rowId === creating.rowId ? { ...r, pickedId: id, input: fields.name } : r,
        ))
        setCreating(null)
      }
      return res
    })
  }

  // Cell-button display: stacked names + pct. Orphan rows get a yellow
  // background + warning tooltip so the encargada knows to fix the data.
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-editing={open ? '' : undefined}
        onClick={() => setOpen(true)}
        title={isOrphan && orphanReason ? `⚠ ${orphanReason} — click para cargar` : undefined}
        className={`w-full text-left px-1 py-0.5 rounded hover:bg-blue-50 transition-colors ${
          isOrphan ? 'bg-warn/15 ring-1 ring-warn/40' : ''
        }`}
      >
        <NamesCell
          noun={kind === 'landlord' ? ['propietario', 'propietarios'] : ['inquilino', 'inquilinos']}
          items={initial.map(p => ({ id: p.id, name: p.name, pct: p.pct }))}
          emptyFallback={
            <span className="text-warn text-[11px]">
              {isOrphan ? '⚠ sin cargar' : '—'}
            </span>
          }
        />
      </button>

      {open && rect && createPortal(
        <>
          {/* click-outside catcher — closes without saving */}
          <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />
          <div
            style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
            className="bg-white border border-gray-300 rounded shadow-lg"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <span className="font-display text-[12.5px] font-medium text-ink capitalize">
                {entityLabelPlural} del contrato
              </span>
              <SumPill values={pcts} />
            </div>

            {/* Auto-rebalance notice — shown when load-time pcts didn't
                sum to 100 (typical for bulk-imported multi-participant
                contracts) and we redistributed equally. */}
            {autoBalanced && (
              <div className="px-3 py-1.5 bg-warn/10 border-b border-warn/30 text-[11px] text-ink">
                Los porcentajes existentes no sumaban 100 — se redistribuyeron en partes
                iguales. Ajustá si querés y tocá <strong>Guardar</strong>.
              </div>
            )}

            {/* Chip rows */}
            <div className="max-h-[320px] overflow-y-auto p-2 space-y-2">
              {rows.map(row => (
                <ChipRowEditor
                  key={row.rowId}
                  row={row}
                  options={optionList}
                  entityLabel={entityLabel}
                  canRemove={rows.length > 1}
                  onChange={(text, pickedId) => patchRow(row.rowId, { input: text, pickedId })}
                  onPctChange={v => patchRow(row.rowId, { pct: v })}
                  onRequestCreate={(name) => setCreating({ rowId: row.rowId, name })}
                  onRemoveConfirmed={() => removeRow(row.rowId)}
                />
              ))}
              <button
                type="button"
                onClick={addRow}
                className="text-[12px] text-info hover:underline font-medium"
              >
                + Agregar {entityLabel}
              </button>
            </div>

            {error && (
              <div className="px-3 py-2 text-[11.5px] text-danger bg-danger/10 border-t border-danger/30">
                {error}
              </div>
            )}

            {/* Footer */}
            <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-end gap-1.5 bg-gray-50">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-2 py-1 text-[11px] text-gray-600 hover:text-ink"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
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

      {creating && (
        <NewEntityModal
          entityType={kind}
          defaultName={creating.name}
          onCancel={() => setCreating(null)}
          onCreate={handleCreateNew}
        />
      )}
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// ChipRowEditor — one row inside the popover: picker + % + 10s [×] button.
// ────────────────────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full h-8 px-2 rounded border border-gray-300 bg-white text-[12px] outline-none focus:border-info transition-colors'

function ChipRowEditor({
  row, options, entityLabel, canRemove,
  onChange, onPctChange, onRequestCreate, onRemoveConfirmed,
}: {
  row:               ChipRow
  options:           { id: string; name: string }[]
  entityLabel:       string
  canRemove:         boolean
  onChange:          (text: string, pickedId: string | null) => void
  onPctChange:       (v: string) => void
  onRequestCreate:   (name: string) => void
  onRemoveConfirmed: () => void
}) {
  return (
    <div className="grid grid-cols-[1fr_70px_auto] gap-1.5 items-start">
      <EntityCombo
        value={row.input}
        pickedId={row.pickedId}
        onChange={onChange}
        onRequestCreate={onRequestCreate}
        options={options}
        entityLabel={entityLabel}
        placeholder="Buscá o tocá «+ Crear»…"
        inputClassName={INPUT_CLASS}
      />
      <input
        type="number"
        value={row.pct}
        onChange={e => onPctChange(e.target.value)}
        min={0}
        max={100}
        step="any"
        placeholder="0"
        className={`${INPUT_CLASS} text-right tabular-nums`}
        aria-label="Porcentaje"
      />
      {/* The [×] is the DelayedActionButton (10s armed countdown).
          Click once → red pulse + countdown. Click again → cancel.
          After 10s the local row is removed (NOT a DB call). The DB
          mutation happens only on Guardar. */}
      {canRemove ? (
        <DelayedActionButton
          variant="danger"
          size="sm"
          delaySeconds={10}
          label="×"
          title="Quitar (mantenelo 10 segundos para confirmar; volvé a tocar para cancelar)"
          onConfirm={onRemoveConfirmed}
        />
      ) : (
        // Disabled placeholder so the grid columns stay aligned.
        <button
          type="button"
          disabled
          title="Tiene que quedar al menos uno"
          className="h-8 px-2.5 text-[11px] rounded text-gray-200 cursor-not-allowed"
        >×</button>
      )}
    </div>
  )
}
