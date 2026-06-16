'use client'

// ============================================================================
// NewContractModal — quick-create form triggered by the "+ Nuevo contrato"
// button above the planilla AND by a floating button at the bottom-right
// of the viewport so it stays reachable when scrolled.
//
// New-entity flow MATCHES the in-cell flow EXACTLY:
//   1. Type in Propietario / Inquilino field
//   2. Autocomplete dropdown shows existing options
//   3. If the typed name doesn't match anything → "+ Crear nuevo X" row at
//      the bottom of the dropdown
//   4. Click it → NewEntityModal opens (same modal the cells use)
//   5. Fill name + DNI/CUIT + phone + email (and notes for landlords)
//   6. Server creates the entity standalone (no redirect) and returns its id
//   7. NewContractModal selects the new entity automatically
//   8. User completes the rest of the form → contract created with existing ids
// ============================================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createContractFromGrid } from '@/lib/contract/junction-actions'
import { createLandlordStandalone } from '@/lib/landlord/actions'
import { createTenantStandalone } from '@/lib/tenant/actions'
import { NewEntityModal, type NewEntityFields } from './NewEntityModal'
import type { LandlordOption } from '@/lib/landlord/queries'
import type { TenantOption } from '@/lib/tenant/queries'

interface Props {
  landlordOptions: LandlordOption[]
  tenantOptions:   TenantOption[]
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

export function NewContractModal({ landlordOptions: initialLandlords, tenantOptions: initialTenants }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  // We keep local option lists so that newly-created entities are visible
  // in the autocomplete immediately, without needing a server round-trip
  // to refresh the page.
  const [landlords, setLandlords] = useState(initialLandlords)
  const [tenants, setTenants]     = useState(initialTenants)

  // Form state
  const [lfa, setLfa] = useState<string>('A')
  const [landlordInput, setLandlordInput] = useState('')
  const [landlordPickedId, setLandlordPickedId] = useState<string | null>(null)
  const [tenantInput, setTenantInput] = useState('')
  const [tenantPickedId, setTenantPickedId] = useState<string | null>(null)
  const [address, setAddress] = useState('')
  const [rent, setRent] = useState('')
  const [pct, setPct] = useState('8')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [cadence, setCadence] = useState<string>('trimestral')

  // Which entity creation modal (if any) is currently open and the
  // prefilled name (passed from the EntityCombo's "+ Crear nuevo" button).
  const [creatingLandlord, setCreatingLandlord] = useState<string | null>(null)
  const [creatingTenant,   setCreatingTenant]   = useState<string | null>(null)

  function reset() {
    setLfa('A')
    setLandlordInput('')
    setLandlordPickedId(null)
    setTenantInput('')
    setTenantPickedId(null)
    setAddress('')
    setRent('')
    setPct('8')
    setStartDate('')
    setEndDate('')
    setCadence('trimestral')
    setError(null)
  }

  function handleClose() {
    if (pending) return
    setOpen(false)
    reset()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!landlordPickedId) return setError('Seleccioná o creá un propietario.')
    if (!tenantPickedId)   return setError('Seleccioná o creá un inquilino.')

    startTransition(async () => {
      const res = await createContractFromGrid({
        lfaCode:       lfa || null,
        landlord:      { kind: 'existing', id: landlordPickedId },
        tenant:        { kind: 'existing', id: tenantPickedId },
        address:       address.trim() || null,
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

      // Refresh FIRST, so the new RSC payload is being fetched while the
      // modal is closing — by the time the modal animates out, the grid
      // is already showing the new contract. Calling refresh outside the
      // transition (via queueMicrotask) avoids being deferred together
      // with the modal state updates.
      queueMicrotask(() => router.refresh())
      setOpen(false)
      reset()
    })
  }

  // ── Entity create handlers — same UX as the cells: NewEntityModal pops
  //    open, we save standalone, then auto-select the new entity in the
  //    contract form.
  function handleCreateLandlord(fields: NewEntityFields): Promise<{ ok: boolean; error?: string | null }> {
    if (fields.kind !== 'landlord') return Promise.resolve({ ok: false, error: 'Tipo inválido.' })
    return createLandlordStandalone({
      name:       fields.name,
      dniOrCuit:  fields.dniOrCuit || null,
      phone:      fields.phone     || null,
      email:      fields.email     || null,
      notes:      fields.notes     || null,
    }).then(res => {
      if (res.ok && res.id) {
        // Auto-select the new landlord and close the entity modal.
        setLandlords(prev => [...prev, { id: res.id!, name: fields.name }])
        setLandlordPickedId(res.id)
        setLandlordInput(fields.name)
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
      if (res.ok && res.id) {
        setTenants(prev => [...prev, { id: res.id!, name: fields.name }])
        setTenantPickedId(res.id)
        setTenantInput(fields.name)
        setCreatingTenant(null)
      }
      return res
    })
  }

  return (
    <>
      {/* Inline button in the filter strip — always visible because the
          filter strip itself sits in the non-scrolling top section. */}
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
            className="relative bg-white border border-gray-300 rounded shadow-xl w-full max-w-[560px] max-h-[92vh] overflow-y-auto"
          >
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-display text-[15px] font-medium text-ink">Nuevo contrato</h2>
                <p className="text-[11.5px] text-gray-500">Carga rápida — los detalles se completan luego desde la ficha del contrato.</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-500 hover:text-ink text-[18px] leading-none px-2"
                aria-label="Cerrar"
              >×</button>
            </div>

            <div className="px-5 py-4 space-y-3">
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
              </div>

              <Field label="Propietario">
                <EntityCombo
                  value={landlordInput}
                  pickedId={landlordPickedId}
                  onChange={(text, pickedId) => { setLandlordInput(text); setLandlordPickedId(pickedId) }}
                  onRequestCreate={(name) => setCreatingLandlord(name)}
                  options={landlords}
                  entityLabel="propietario"
                  placeholder="Buscá o tocá «+ Crear nuevo propietario»…"
                />
              </Field>

              <Field label="Inquilino">
                <EntityCombo
                  value={tenantInput}
                  pickedId={tenantPickedId}
                  onChange={(text, pickedId) => { setTenantInput(text); setTenantPickedId(pickedId) }}
                  onRequestCreate={(name) => setCreatingTenant(name)}
                  options={tenants}
                  entityLabel="inquilino"
                  placeholder="Buscá o tocá «+ Crear nuevo inquilino»…"
                />
              </Field>

              <Field label="Dirección (opcional)">
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Av. Rivadavia 1234, Depto 3B"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Alquiler ($)">
                  {/* step="any" — the browser won't reject "12354" or any
                      other non-rounded amount. This silently blocked the
                      form before, which is why new contracts never reached
                      the database. */}
                  <input type="number" value={rent} onChange={e => setRent(e.target.value)} placeholder="500000" min={1} step="any" className={inputCls} />
                </Field>
                <Field label="Comisión (%)">
                  <input type="number" value={pct} onChange={e => setPct(e.target.value)} min={0} max={100} step="any" className={inputCls} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Vigencia desde">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Vigencia hasta">
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
                </Field>
              </div>

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
      {creatingLandlord !== null && (
        <NewEntityModal
          entityType="landlord"
          defaultName={creatingLandlord}
          onCancel={() => setCreatingLandlord(null)}
          onCreate={handleCreateLandlord}
        />
      )}
      {creatingTenant !== null && (
        <NewEntityModal
          entityType="tenant"
          defaultName={creatingTenant}
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

// ── EntityCombo with autocomplete + always-visible "+ Crear nuevo X" banner.
//
// The dropdown is portal-rendered to document.body so it escapes the
// modal form's overflow-y-auto context (the bug the user reported was
// that the "+ Crear nuevo" button sat below the dropdown and got clipped
// when the form scrolled). The banner sits INLINE below the input — never
// clipped, always visible the moment the typed text matches nothing.
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
  // The "+ Crear nuevo" affordance only matters when she has actually typed
  // something — an empty input doesn't need a Create button.
  const showCreateBanner = !exact && value.trim().length > 0 && !pickedId

  // Recompute dropdown position when open, on scroll, on resize.
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
        <span className="absolute right-2 top-2 text-[10px] text-success font-medium" aria-hidden>✓ vinculado</span>
      )}

      {/* Always-visible "+ Crear nuevo" banner — sits inline directly under
          the input so it can never be clipped by the modal form's overflow.
          The cell flow uses an in-dropdown row; here the banner is safer
          because the modal form has its own scrolling context. */}
      {showCreateBanner && (
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); onRequestCreate(value.trim()); setOpen(false) }}
          className="mt-1 w-full text-left px-3 py-2 rounded border-2 border-warn/60 bg-warn/10 hover:bg-warn/20 text-[12.5px] text-ink font-medium cursor-pointer transition-colors flex items-center gap-2"
        >
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-warn text-ink text-[12px] font-bold">+</span>
          <span>Crear nuevo {entityLabel}: <span className="font-semibold">«{value.trim()}»</span></span>
        </button>
      )}

      {/* Dropdown — portal-rendered so it escapes the form's overflow-y-auto
          and shows on top of everything else inside the modal. */}
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
