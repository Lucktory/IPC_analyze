'use client'

// ============================================================================
// NewContractModal — co-ownership / co-tenancy capable contract creation.
//
// Three stacked sections (Alejandro's "everything visible" principle — no
// wizard, no tabs):
//
//   1. PROPERTY — existing (autocomplete) or new (address + type)
//        • Picking an existing property auto-preloads its current owners
//          into Section 2 as a starting point.
//        • The encargada can then override the per-contract distribution
//          without touching the property's general ownership record.
//
//   2. PROPIETARIOS — one row per co-owner.
//        • Each row: landlord picker + ownership_pct.
//        • "+ Agregar propietario" adds a row.
//        • Live sum indicator turns green at 100, red otherwise.
//
//   3. INQUILINOS — one row per co-tenant.
//        • Each row: tenant picker + share_pct.
//        • "+ Agregar inquilino" adds a row.
//        • Same live sum indicator.
//
//   4. Contract metadata — LFA, cadencia, alquiler, comisión, vigencia.
//
// The submit handler hands the arrays to createContractFromGrid which
// validates sums server-side and writes all the junction rows in one go.
// ============================================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  createContractFromGrid,
  type ContractLandlordInput,
  type ContractTenantInput,
} from '@/lib/contract/junction-actions'
import { createLandlordStandalone } from '@/lib/landlord/actions'
import { createTenantStandalone } from '@/lib/tenant/actions'
import { fetchPropertyOwners } from '@/lib/property/actions'
import { NewEntityModal, type NewEntityFields } from './NewEntityModal'
import type { LandlordOption } from '@/lib/landlord/queries'
import type { TenantOption } from '@/lib/tenant/queries'
import type { PropertyOption } from '@/lib/property/queries'

interface Props {
  landlordOptions: LandlordOption[]
  tenantOptions:   TenantOption[]
  propertyOptions: PropertyOption[]
}

const LFA_OPTIONS = ['L', 'F', 'A', 'FL', 'D'] as const
const CADENCE_OPTIONS = [
  { value: 'mensual',        label: 'Mensual' },
  { value: 'bimestral',      label: 'Bimestral' },
  { value: 'trimestral',     label: 'Trimestral' },
  { value: 'cuatrimestral',  label: 'Cuatrimestral' },
  { value: 'semestral',      label: 'Semestral' },
  { value: 'anual',          label: 'Anual' },
] as const

const PROPERTY_TYPES = [
  { value: 'vivienda', label: 'Vivienda' },
  { value: 'local',    label: 'Local' },
  { value: 'oficina',  label: 'Oficina' },
  { value: 'cochera',  label: 'Cochera' },
  { value: 'deposito', label: 'Depósito' },
] as const

// Floating-point sum tolerance — matches the server's PCT_SUM_EPSILON
// so client-side validation matches the server's check exactly.
const PCT_SUM_EPSILON = 0.05

// Local UI id for dynamic rows. Not a database id — never sent to the server.
function makeRowId() {
  return `row-${Math.random().toString(36).slice(2, 9)}`
}

interface LandlordRow {
  rowId:    string
  pickedId: string | null
  input:    string
  pct:      string  // string so the user can type "33.33" without forced parsing
}
interface TenantRow {
  rowId:    string
  pickedId: string | null
  input:    string
  pct:      string
}

export function NewContractModal({
  landlordOptions: initialLandlords,
  tenantOptions:   initialTenants,
  propertyOptions,
}: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  // Option lists that grow as the user creates new entities inline.
  const [landlords, setLandlords] = useState(initialLandlords)
  const [tenants, setTenants]     = useState(initialTenants)

  // Sync option lists when the parent server-rendered options change
  // (e.g. after a router.refresh from a sibling cell).
  useEffect(() => { setLandlords(initialLandlords) }, [initialLandlords])
  useEffect(() => { setTenants(initialTenants) },     [initialTenants])

  // ── Section 1: PROPERTY ────────────────────────────────────────────────
  const [propertyMode, setPropertyMode] = useState<'existing' | 'new'>('existing')
  const [pickedPropertyId, setPickedPropertyId] = useState<string | null>(null)
  const [propertyInput, setPropertyInput]       = useState('')
  // New-property fields:
  const [newPropertyAddress, setNewPropertyAddress] = useState('')
  const [newPropertyType, setNewPropertyType]       = useState<string>('vivienda')

  // ── Section 2: PROPIETARIOS ────────────────────────────────────────────
  const [landlordRows, setLandlordRows] = useState<LandlordRow[]>([
    { rowId: makeRowId(), pickedId: null, input: '', pct: '100' },
  ])
  // Which row (if any) is currently asking to create a new landlord.
  const [creatingLandlord, setCreatingLandlord] = useState<{ rowId: string; name: string } | null>(null)

  // ── Section 3: INQUILINOS ──────────────────────────────────────────────
  const [tenantRows, setTenantRows] = useState<TenantRow[]>([
    { rowId: makeRowId(), pickedId: null, input: '', pct: '100' },
  ])
  const [creatingTenant, setCreatingTenant] = useState<{ rowId: string; name: string } | null>(null)

  // ── Section 4: Contract metadata ───────────────────────────────────────
  const [lfa, setLfa] = useState<string>('A')
  const [rent, setRent] = useState('')
  const [pct, setPct] = useState('8')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [cadence, setCadence] = useState<string>('trimestral')

  function reset() {
    setPropertyMode('existing')
    setPickedPropertyId(null)
    setPropertyInput('')
    setNewPropertyAddress('')
    setNewPropertyType('vivienda')
    setLandlordRows([{ rowId: makeRowId(), pickedId: null, input: '', pct: '100' }])
    setTenantRows([{ rowId: makeRowId(), pickedId: null, input: '', pct: '100' }])
    setLfa('A')
    setRent('')
    setPct('8')
    setStartDate('')
    setEndDate('')
    setCadence('trimestral')
    setError(null)
    setCreatingLandlord(null)
    setCreatingTenant(null)
  }

  function handleClose() {
    if (pending) return
    setOpen(false)
    reset()
  }

  // ── When the encargada picks an existing property, preload its owners
  //    as the starting point for the contract's per-contract distribution.
  useEffect(() => {
    if (propertyMode !== 'existing' || !pickedPropertyId) return
    let cancelled = false
    ;(async () => {
      try {
        const owners = await fetchPropertyOwners(pickedPropertyId)
        if (cancelled) return
        if (owners.length === 0) return
        setLandlordRows(owners.map(o => ({
          rowId:    makeRowId(),
          pickedId: o.landlordId,
          input:    o.landlordName,
          pct:      String(o.ownershipPct),
        })))
      } catch (err) {
        console.error('[NewContractModal] fetchPropertyOwners failed:', err)
      }
    })()
    return () => { cancelled = true }
  }, [propertyMode, pickedPropertyId])

  // ── Live percentage sums ───────────────────────────────────────────────
  const landlordSum = landlordRows.reduce((s, r) => s + (Number(r.pct) || 0), 0)
  const tenantSum   = tenantRows.reduce((s, r) => s + (Number(r.pct) || 0), 0)
  const landlordSumOk = Math.abs(landlordSum - 100) <= PCT_SUM_EPSILON
  const tenantSumOk   = Math.abs(tenantSum   - 100) <= PCT_SUM_EPSILON

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // ── Client-side validation that mirrors the server ─────────────────
    if (propertyMode === 'existing' && !pickedPropertyId) {
      return setError('Seleccioná una propiedad o cambiá a "Nueva propiedad".')
    }
    if (propertyMode === 'new' && !newPropertyAddress.trim()) {
      return setError('Ingresá la dirección de la nueva propiedad.')
    }
    if (landlordRows.some(r => !r.pickedId)) {
      return setError('Todos los propietarios deben estar seleccionados o creados.')
    }
    if (tenantRows.some(r => !r.pickedId)) {
      return setError('Todos los inquilinos deben estar seleccionados o creados.')
    }
    if (!landlordSumOk) {
      return setError(`Los porcentajes de propietarios deben sumar 100% (suman ${landlordSum.toFixed(2)}%).`)
    }
    if (!tenantSumOk) {
      return setError(`Los porcentajes de inquilinos deben sumar 100% (suman ${tenantSum.toFixed(2)}%).`)
    }

    const landlordsPayload: ContractLandlordInput[] = landlordRows.map(r => ({
      landlord:     { kind: 'existing', id: r.pickedId! },
      ownershipPct: Number(r.pct),
    }))
    const tenantsPayload: ContractTenantInput[] = tenantRows.map(r => ({
      tenant:   { kind: 'existing', id: r.pickedId! },
      sharePct: Number(r.pct),
    }))

    startTransition(async () => {
      const res = await createContractFromGrid({
        lfaCode:       lfa || null,
        property:
          propertyMode === 'existing'
            ? { kind: 'existing', id: pickedPropertyId! }
            : { kind: 'new', address: newPropertyAddress.trim(), propertyType: newPropertyType },
        landlords:     landlordsPayload,
        tenants:       tenantsPayload,
        currentRent:   Number(rent),
        commissionPct: Number(pct),
        startDate,
        endDate,
        cadence,
      })
      if (!res.ok) {
        setError(res.error ?? 'Error al crear el contrato')
        return
      }
      queueMicrotask(() => router.refresh())
      setOpen(false)
      reset()
    })
  }

  // ── Inline-entity creation handlers — same UX as the cells ──────────────
  function handleCreateLandlord(fields: NewEntityFields): Promise<{ ok: boolean; error?: string | null }> {
    if (fields.kind !== 'landlord') return Promise.resolve({ ok: false, error: 'Tipo inválido.' })
    return createLandlordStandalone({
      name:       fields.name,
      dniOrCuit:  fields.dniOrCuit || null,
      phone:      fields.phone     || null,
      email:      fields.email     || null,
      notes:      fields.notes     || null,
    }).then(res => {
      if (res.ok && res.id && creatingLandlord) {
        const newId = res.id
        setLandlords(prev => [...prev, { id: newId, name: fields.name }])
        // Wire the new id back into the originating row.
        setLandlordRows(prev => prev.map(r =>
          r.rowId === creatingLandlord.rowId
            ? { ...r, pickedId: newId, input: fields.name }
            : r,
        ))
        setCreatingLandlord(null)
      }
      return res
    })
  }

  function handleCreateTenant(fields: NewEntityFields): Promise<{ ok: boolean; error?: string | null }> {
    if (fields.kind !== 'tenant') return Promise.resolve({ ok: false, error: 'Tipo inválido.' })
    return createTenantStandalone({
      name:  fields.name,
      dni:   fields.dni   || null,
      phone: fields.phone || null,
      email: fields.email || null,
    }).then(res => {
      if (res.ok && res.id && creatingTenant) {
        const newId = res.id
        setTenants(prev => [...prev, { id: newId, name: fields.name }])
        setTenantRows(prev => prev.map(r =>
          r.rowId === creatingTenant.rowId
            ? { ...r, pickedId: newId, input: fields.name }
            : r,
        ))
        setCreatingTenant(null)
      }
      return res
    })
  }

  // ── Row manipulators ──────────────────────────────────────────────────
  function addLandlordRow() {
    setLandlordRows(prev => [...prev, { rowId: makeRowId(), pickedId: null, input: '', pct: '0' }])
  }
  function removeLandlordRow(rowId: string) {
    setLandlordRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.rowId !== rowId))
  }
  function patchLandlordRow(rowId: string, patch: Partial<LandlordRow>) {
    setLandlordRows(prev => prev.map(r => r.rowId === rowId ? { ...r, ...patch } : r))
  }

  function addTenantRow() {
    setTenantRows(prev => [...prev, { rowId: makeRowId(), pickedId: null, input: '', pct: '0' }])
  }
  function removeTenantRow(rowId: string) {
    setTenantRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.rowId !== rowId))
  }
  function patchTenantRow(rowId: string, patch: Partial<TenantRow>) {
    setTenantRows(prev => prev.map(r => r.rowId === rowId ? { ...r, ...patch } : r))
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-ink text-paper text-[11.5px] font-medium hover:opacity-90 transition-opacity shrink-0"
      >
        + Nuevo contrato
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1050] flex items-center justify-center px-4"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={handleClose}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
          />

          <form
            onSubmit={handleSubmit}
            className="relative bg-white border border-gray-300 rounded shadow-xl w-full max-w-[640px] max-h-[92vh] overflow-y-auto"
          >
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-display text-[15px] font-medium text-ink">Nuevo contrato</h2>
                <p className="text-[11.5px] text-gray-500">
                  Cargá propiedad, co-propietarios e inquilinos. Los porcentajes deben sumar 100.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-500 hover:text-ink text-[18px] leading-none px-2"
                aria-label="Cerrar"
              >×</button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* ── Section 1: PROPERTY ────────────────────────────────── */}
              <section>
                <SectionHeader label="Propiedad" />
                <div className="flex items-center gap-3 mb-2 text-[12px]">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={propertyMode === 'existing'}
                      onChange={() => setPropertyMode('existing')}
                    />
                    <span>Existente</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={propertyMode === 'new'}
                      onChange={() => setPropertyMode('new')}
                    />
                    <span>Nueva</span>
                  </label>
                </div>

                {propertyMode === 'existing' ? (
                  <PropertyCombo
                    value={propertyInput}
                    pickedId={pickedPropertyId}
                    onChange={(text, pickedId) => { setPropertyInput(text); setPickedPropertyId(pickedId) }}
                    options={propertyOptions}
                  />
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Field label="Dirección">
                        <input
                          type="text"
                          value={newPropertyAddress}
                          onChange={e => setNewPropertyAddress(e.target.value)}
                          placeholder="Mitre 674, depto 5B"
                          className={inputCls}
                        />
                      </Field>
                    </div>
                    <Field label="Tipo">
                      <select value={newPropertyType} onChange={e => setNewPropertyType(e.target.value)} className={selectCls}>
                        {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </Field>
                  </div>
                )}
              </section>

              {/* ── Section 2: PROPIETARIOS ────────────────────────────── */}
              <section>
                <SectionHeader
                  label="Propietarios"
                  rightAdornment={
                    <SumPill ok={landlordSumOk} value={landlordSum} />
                  }
                />
                <div className="space-y-2">
                  {landlordRows.map(row => (
                    <EntityRow
                      key={row.rowId}
                      input={row.input}
                      pickedId={row.pickedId}
                      pct={row.pct}
                      options={landlords}
                      entityLabel="propietario"
                      placeholder="Buscá o tocá «+ Crear»…"
                      onChange={(text, pickedId) => patchLandlordRow(row.rowId, { input: text, pickedId })}
                      onPctChange={v => patchLandlordRow(row.rowId, { pct: v })}
                      onRequestCreate={(name) => setCreatingLandlord({ rowId: row.rowId, name })}
                      onRemove={landlordRows.length > 1 ? () => removeLandlordRow(row.rowId) : undefined}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={addLandlordRow}
                    className="text-[12px] text-info hover:underline font-medium"
                  >
                    + Agregar propietario
                  </button>
                </div>
              </section>

              {/* ── Section 3: INQUILINOS ──────────────────────────────── */}
              <section>
                <SectionHeader
                  label="Inquilinos"
                  rightAdornment={
                    <SumPill ok={tenantSumOk} value={tenantSum} />
                  }
                />
                <div className="space-y-2">
                  {tenantRows.map(row => (
                    <EntityRow
                      key={row.rowId}
                      input={row.input}
                      pickedId={row.pickedId}
                      pct={row.pct}
                      options={tenants}
                      entityLabel="inquilino"
                      placeholder="Buscá o tocá «+ Crear»…"
                      onChange={(text, pickedId) => patchTenantRow(row.rowId, { input: text, pickedId })}
                      onPctChange={v => patchTenantRow(row.rowId, { pct: v })}
                      onRequestCreate={(name) => setCreatingTenant({ rowId: row.rowId, name })}
                      onRemove={tenantRows.length > 1 ? () => removeTenantRow(row.rowId) : undefined}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={addTenantRow}
                    className="text-[12px] text-info hover:underline font-medium"
                  >
                    + Agregar inquilino
                  </button>
                </div>
              </section>

              {/* ── Section 4: Contract metadata ───────────────────────── */}
              <section>
                <SectionHeader label="Contrato" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="LFA">
                    <select value={lfa} onChange={e => setLfa(e.target.value)} className={selectCls}>
                      {LFA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Cadencia IPC">
                    <select value={cadence} onChange={e => setCadence(e.target.value)} className={selectCls}>
                      {CADENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Alquiler ($)">
                    <input type="number" value={rent} onChange={e => setRent(e.target.value)} placeholder="500000" min={1} step="any" className={inputCls} />
                  </Field>
                  <Field label="Comisión (%)">
                    <input type="number" value={pct} onChange={e => setPct(e.target.value)} min={0} max={100} step="any" className={inputCls} />
                  </Field>
                  <Field label="Vigencia desde">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Vigencia hasta">
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
                  </Field>
                </div>
              </section>

              {error && (
                <div className="text-[11.5px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50 sticky bottom-0">
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                className="px-3 py-1.5 rounded border border-gray-300 text-[12px] text-slate-dark hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-3 py-1.5 rounded bg-ink text-paper text-[12px] font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {pending ? 'Creando…' : 'Crear contrato'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Entity-creation modals — same component the cells use. */}
      {creatingLandlord && (
        <NewEntityModal
          entityType="landlord"
          defaultName={creatingLandlord.name}
          onCancel={() => setCreatingLandlord(null)}
          onCreate={handleCreateLandlord}
        />
      )}
      {creatingTenant && (
        <NewEntityModal
          entityType="tenant"
          defaultName={creatingTenant.name}
          onCancel={() => setCreatingTenant(null)}
          onCreate={handleCreateTenant}
        />
      )}
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────

const inputCls    = 'w-full h-9 px-2 rounded border border-gray-300 bg-white text-[13px] outline-none focus:border-info transition-colors'
const selectCls   = 'w-full h-9 px-2 rounded border border-gray-300 bg-white text-[13px] outline-none focus:border-info transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-cap block mb-1">{label}</span>
      {children}
    </label>
  )
}

function SectionHeader({ label, rightAdornment }: { label: string; rightAdornment?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
      <h3 className="font-display text-[13px] font-medium text-ink">{label}</h3>
      {rightAdornment}
    </div>
  )
}

function SumPill({ ok, value }: { ok: boolean; value: number }) {
  return (
    <span
      className={`text-[11px] tabular-nums px-2 py-0.5 rounded ${
        ok
          ? 'bg-success/10 text-success'
          : 'bg-danger/10 text-danger'
      }`}
      title={ok ? 'Los porcentajes suman 100%' : 'Los porcentajes deben sumar exactamente 100%'}
    >
      Σ {value.toFixed(2)}%
    </span>
  )
}

// ── One landlord/tenant row: picker + % input + remove ──────────────────────
function EntityRow({
  input, pickedId, pct, options, entityLabel, placeholder,
  onChange, onPctChange, onRequestCreate, onRemove,
}: {
  input:           string
  pickedId:        string | null
  pct:             string
  options:         { id: string; name: string }[]
  entityLabel:     string
  placeholder:     string
  onChange:        (text: string, pickedId: string | null) => void
  onPctChange:     (v: string) => void
  onRequestCreate: (name: string) => void
  onRemove?:       () => void
}) {
  return (
    <div className="grid grid-cols-[1fr_90px_28px] gap-2 items-start">
      <EntityCombo
        value={input}
        pickedId={pickedId}
        onChange={onChange}
        onRequestCreate={onRequestCreate}
        options={options}
        entityLabel={entityLabel}
        placeholder={placeholder}
      />
      <div>
        <input
          type="number"
          value={pct}
          onChange={e => onPctChange(e.target.value)}
          min={0}
          max={100}
          step="any"
          placeholder="100"
          className={`${inputCls} text-right tabular-nums`}
          aria-label="Porcentaje"
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={!onRemove}
        title={onRemove ? 'Quitar' : 'Tiene que quedar al menos uno'}
        className={`h-9 w-7 text-[18px] leading-none rounded ${
          onRemove ? 'text-gray-400 hover:text-danger transition-colors' : 'text-gray-200 cursor-not-allowed'
        }`}
      >×</button>
    </div>
  )
}

// ── Property picker — simpler combo just for property addresses ────────────
function PropertyCombo({
  value, pickedId, onChange, options,
}: {
  value:    string
  pickedId: string | null
  onChange: (text: string, pickedId: string | null) => void
  options:  PropertyOption[]
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = value.trim()
    ? options.filter(o => o.address.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 10)
    : options.slice(0, 10)

  useEffect(() => {
    if (!open || !inputRef.current) return
    const compute = () => {
      const r = inputRef.current?.getBoundingClientRect()
      if (!r) return
      setRect({ top: r.bottom + window.scrollY + 2, left: r.left + window.scrollX, width: r.width })
    }
    compute()
    window.addEventListener('scroll', compute, true)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', compute, true)
      window.removeEventListener('resize', compute)
    }
  }, [open])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={e => onChange(e.target.value, null)}
        placeholder="Buscá una propiedad cargada…"
        className={`${inputCls} ${pickedId ? 'border-success/60 bg-success/5' : ''}`}
      />
      {pickedId && (
        <span className="absolute right-2 top-2 text-[10px] text-success font-medium" aria-hidden>✓ vinculada</span>
      )}
      {open && rect && createPortal(
        <ul
          role="listbox"
          style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1080 }}
          className="bg-white border border-gray-300 rounded shadow-lg max-h-[240px] overflow-y-auto"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-1.5 text-[12px] text-gray-500 italic">
              {value.trim() ? 'Sin coincidencias.' : 'Escribí para buscar una propiedad…'}
            </li>
          )}
          {filtered.map(o => (
            <li
              key={o.id}
              role="option"
              onMouseDown={e => { e.preventDefault(); onChange(o.address, o.id); setOpen(false) }}
              className="px-3 py-1.5 text-[12.5px] text-slate-dark hover:bg-info/10 hover:text-ink cursor-pointer truncate"
            >
              {o.address}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  )
}

// ── EntityCombo (landlord/tenant) — autocomplete + inline "+ Crear" ─────────
function EntityCombo({
  value, pickedId, onChange, onRequestCreate, options, entityLabel, placeholder,
}: {
  value:           string
  pickedId:        string | null
  onChange:        (text: string, pickedId: string | null) => void
  onRequestCreate: (name: string) => void
  options:         { id: string; name: string }[]
  entityLabel:     string
  placeholder:     string
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = value.trim()
    ? options.filter(o => o.name.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 8)
    : options.slice(0, 8)
  const exact = options.find(o => o.name.trim().toLowerCase() === value.trim().toLowerCase())
  const showCreateBanner = !exact && value.trim().length > 0 && !pickedId

  useEffect(() => {
    if (!open || !inputRef.current) return
    const compute = () => {
      const r = inputRef.current?.getBoundingClientRect()
      if (!r) return
      setRect({ top: r.bottom + window.scrollY + 2, left: r.left + window.scrollX, width: r.width })
    }
    compute()
    window.addEventListener('scroll', compute, true)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', compute, true)
      window.removeEventListener('resize', compute)
    }
  }, [open])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={e => onChange(e.target.value, null)}
        placeholder={placeholder}
        className={`${inputCls} ${pickedId ? 'border-success/60 bg-success/5' : ''}`}
      />
      {pickedId && (
        <span className="absolute right-2 top-2 text-[10px] text-success font-medium" aria-hidden>✓</span>
      )}
      {showCreateBanner && (
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); onRequestCreate(value.trim()); setOpen(false) }}
          className="mt-1 w-full text-left px-2 py-1 rounded border border-warn/60 bg-warn/10 hover:bg-warn/20 text-[11.5px] text-ink font-medium cursor-pointer transition-colors"
        >
          + Crear nuevo {entityLabel}: «{value.trim()}»
        </button>
      )}
      {open && rect && createPortal(
        <ul
          role="listbox"
          style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1080 }}
          className="bg-white border border-gray-300 rounded shadow-lg max-h-[240px] overflow-y-auto"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-1.5 text-[12px] text-gray-500 italic">
              {value.trim() ? 'Sin coincidencias.' : `Escribí para buscar un ${entityLabel}…`}
            </li>
          )}
          {filtered.map(o => (
            <li
              key={o.id}
              role="option"
              onMouseDown={e => { e.preventDefault(); onChange(o.name, o.id); setOpen(false) }}
              className="px-3 py-1.5 text-[12.5px] text-slate-dark hover:bg-info/10 hover:text-ink cursor-pointer truncate"
            >
              {o.name}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  )
}
