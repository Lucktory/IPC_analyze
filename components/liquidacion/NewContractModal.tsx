'use client'

// ============================================================================
// NewContractModal — quick-create form triggered by the "+ Nuevo contrato"
// button above the planilla. Uses the same autocomplete + new-name flow as
// the in-cell editors, so the encargada can pick an existing propietario /
// inquilino or type a brand-new name in the same field.
//
// Minimum required fields (everything else editable from contract detail):
//   • LFA (L / F / A / FL / D)
//   • Propietario  — autocomplete from landlords
//   • Inquilino    — autocomplete from tenants
//   • Dirección    — optional placeholder text; can be set later
//   • Alquiler     — initial rent
//   • Comisión %   — Pampa cut
//   • Vigencia     — start + end dates
//   • Cadencia     — IPC cadence
//
// Submit calls createContractFromGrid, which handles the create-if-new for
// landlord/tenant and auto-creates a placeholder property.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createContractFromGrid } from '@/lib/contract/junction-actions'
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

export function NewContractModal({ landlordOptions, tenantOptions }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

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

    const landlord = landlordPickedId
      ? { kind: 'existing' as const, id: landlordPickedId }
      : { kind: 'new' as const, name: landlordInput.trim() }
    const tenant = tenantPickedId
      ? { kind: 'existing' as const, id: tenantPickedId }
      : { kind: 'new' as const, name: tenantInput.trim() }

    if (!landlord.id && !landlord.name)            return setError('Ingresá el propietario.')
    if (!tenant.id && !tenant.name)                return setError('Ingresá el inquilino.')

    startTransition(async () => {
      const res = await createContractFromGrid({
        lfaCode:       lfa || null,
        landlord,
        tenant,
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
      setOpen(false)
      reset()
      router.refresh()
    })
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
          className="fixed inset-0 z-[1100] flex items-center justify-center px-4"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={handleClose}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
          />

          <form
            onSubmit={handleSubmit}
            className="relative bg-paper border border-line rounded shadow-xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto"
          >
            <div className="px-5 py-3 border-b border-line flex items-center justify-between">
              <div>
                <h2 className="font-display text-[15px] font-medium text-ink">Nuevo contrato</h2>
                <p className="text-[11.5px] text-slate">Carga rápida — los detalles se completan luego desde la ficha del contrato.</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-slate hover:text-ink text-[18px] leading-none px-2"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="LFA">
                  <select
                    value={lfa}
                    onChange={e => setLfa(e.target.value)}
                    className={selectCls}
                  >
                    {LFA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Cadencia IPC">
                  <select
                    value={cadence}
                    onChange={e => setCadence(e.target.value)}
                    className={selectCls}
                  >
                    {CADENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Propietario">
                <EntityCombo
                  value={landlordInput}
                  onChange={(text, pickedId) => { setLandlordInput(text); setLandlordPickedId(pickedId) }}
                  options={landlordOptions}
                  placeholder="Buscá o escribí nombre nuevo…"
                />
              </Field>

              <Field label="Inquilino">
                <EntityCombo
                  value={tenantInput}
                  onChange={(text, pickedId) => { setTenantInput(text); setTenantPickedId(pickedId) }}
                  options={tenantOptions}
                  placeholder="Buscá o escribí nombre nuevo…"
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
                  <input
                    type="number"
                    value={rent}
                    onChange={e => setRent(e.target.value)}
                    placeholder="500000"
                    min={1}
                    step={100}
                    className={inputCls}
                  />
                </Field>
                <Field label="Comisión (%)">
                  <input
                    type="number"
                    value={pct}
                    onChange={e => setPct(e.target.value)}
                    min={0}
                    max={100}
                    step={0.1}
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Vigencia desde">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Vigencia hasta">
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>

              {error && (
                <div className="text-[11.5px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-line flex items-center justify-end gap-2 bg-cream/40">
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                className="px-3 py-1.5 rounded border border-line text-[12px] text-slate-dark hover:bg-cream-2 transition-colors"
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
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────

const inputCls  = 'w-full h-9 px-2 rounded border border-line bg-paper text-[13px] outline-none focus:border-ink transition-colors'
const selectCls = 'w-full h-9 px-2 rounded border border-line bg-paper text-[13px] outline-none focus:border-ink transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-cap block mb-1">{label}</span>
      {children}
    </label>
  )
}

// ── EntityCombo: lightweight autocomplete for the modal. Uses native
//    datalist-style filtering with a hand-rolled dropdown so the create-new
//    flow stays clean. Selecting from the dropdown sets pickedId; typing
//    free text clears it (signals "create new" intent at submit).
function EntityCombo({
  value, onChange, options, placeholder,
}: {
  value:       string
  onChange:    (text: string, pickedId: string | null) => void
  options:     { id: string; name: string }[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const filtered = value.trim()
    ? options.filter(o => o.name.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 8)
    : options.slice(0, 8)
  const exact = options.find(o => o.name.trim().toLowerCase() === value.trim().toLowerCase())

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={e => onChange(e.target.value, null)}
        placeholder={placeholder}
        className={inputCls}
      />
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-10 bg-paper border border-line rounded shadow-lg max-h-[200px] overflow-y-auto"
        >
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
          {!exact && value.trim() && (
            <li className="px-3 py-1.5 text-[11px] text-ink bg-warn/15 border-t border-line italic">
              ⚠ &ldquo;{value.trim()}&rdquo; no existe — se creará nuevo al guardar
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
