'use client'

// ============================================================================
// NewContractModal — quick-create form triggered by the "+ Nuevo contrato"
// button above the planilla (and also from a floating button bottom-right
// so it's always reachable).
//
// Uses the same autocomplete + new-name flow as the in-cell editors. When
// the encargada types a name that doesn't match any existing record, a
// clear "Nuevo X detectado" warning appears and the form expands to
// capture the new entity's contact details (phone / email / DNI / CUIT).
//
// Submit calls createContractFromGrid which handles the create-if-new for
// landlord/tenant (with the enriched fields) and auto-creates a placeholder
// property.
// ============================================================================

import { useMemo, useState, useTransition } from 'react'
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

  // ── Form state ────────────────────────────────────────────────────────────
  const [lfa, setLfa] = useState<string>('A')
  const [landlordInput, setLandlordInput] = useState('')
  const [landlordPickedId, setLandlordPickedId] = useState<string | null>(null)
  // Extra fields shown when landlord is detected as a NEW entity
  const [landlordDni,   setLandlordDni]   = useState('')
  const [landlordPhone, setLandlordPhone] = useState('')
  const [landlordEmail, setLandlordEmail] = useState('')

  const [tenantInput, setTenantInput] = useState('')
  const [tenantPickedId, setTenantPickedId] = useState<string | null>(null)
  const [tenantDni,   setTenantDni]   = useState('')
  const [tenantPhone, setTenantPhone] = useState('')
  const [tenantEmail, setTenantEmail] = useState('')

  const [address, setAddress] = useState('')
  const [rent, setRent] = useState('')
  const [pct, setPct] = useState('8')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [cadence, setCadence] = useState<string>('trimestral')

  // ── Derived: is this a new entity? ────────────────────────────────────────
  const landlordIsNew = useMemo(() => {
    if (landlordPickedId) return false
    const t = landlordInput.trim().toLowerCase()
    if (!t) return false
    return !landlordOptions.some(o => o.name.trim().toLowerCase() === t)
  }, [landlordPickedId, landlordInput, landlordOptions])

  const tenantIsNew = useMemo(() => {
    if (tenantPickedId) return false
    const t = tenantInput.trim().toLowerCase()
    if (!t) return false
    return !tenantOptions.some(o => o.name.trim().toLowerCase() === t)
  }, [tenantPickedId, tenantInput, tenantOptions])

  function reset() {
    setLfa('A')
    setLandlordInput('')
    setLandlordPickedId(null)
    setLandlordDni('')
    setLandlordPhone('')
    setLandlordEmail('')
    setTenantInput('')
    setTenantPickedId(null)
    setTenantDni('')
    setTenantPhone('')
    setTenantEmail('')
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
      : {
          kind: 'new' as const,
          name:      landlordInput.trim(),
          dniOrCuit: landlordDni.trim() || null,
          phone:     landlordPhone.trim() || null,
          email:     landlordEmail.trim() || null,
        }
    const tenant = tenantPickedId
      ? { kind: 'existing' as const, id: tenantPickedId }
      : {
          kind: 'new' as const,
          name:  tenantInput.trim(),
          dni:   tenantDni.trim() || null,
          phone: tenantPhone.trim() || null,
          email: tenantEmail.trim() || null,
        }

    if (landlord.kind === 'new' && !landlord.name) return setError('Ingresá el propietario.')
    if (tenant.kind === 'new'   && !tenant.name)   return setError('Ingresá el inquilino.')

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
      {/* Inline button — sits in the filter strip above the grid. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-ink text-paper text-[11.5px] font-medium hover:opacity-90 transition-opacity shrink-0"
      >
        + Nuevo contrato
      </button>

      {/* Floating fallback — always visible at the bottom-right of the
          viewport, so the encargada can add a contract regardless of how
          far down she has scrolled in the planilla. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Nuevo contrato"
        aria-label="Nuevo contrato"
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-ink text-paper text-[13px] font-medium shadow-lg hover:opacity-90 transition-opacity print:hidden"
      >
        <span className="text-[16px] leading-none">+</span>
        <span>Nuevo contrato</span>
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
            className="relative bg-white border border-gray-300 rounded shadow-xl w-full max-w-[600px] max-h-[92vh] overflow-y-auto"
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
              >
                ×
              </button>
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

              {/* ── Propietario ─────────────────────────────────────────── */}
              <Field label="Propietario">
                <EntityCombo
                  value={landlordInput}
                  onChange={(text, pickedId) => { setLandlordInput(text); setLandlordPickedId(pickedId) }}
                  options={landlordOptions}
                  placeholder="Buscá o escribí nombre nuevo…"
                />
              </Field>

              {landlordIsNew && (
                <NewEntityBanner label="propietario" name={landlordInput.trim()}>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <SubField label="DNI / CUIT">
                      <input type="text" value={landlordDni}   onChange={e => setLandlordDni(e.target.value)}   className={subInputCls} placeholder="Opcional" />
                    </SubField>
                    <SubField label="Teléfono">
                      <input type="tel"  value={landlordPhone} onChange={e => setLandlordPhone(e.target.value)} className={subInputCls} placeholder="Opcional" />
                    </SubField>
                    <SubField label="Email" colSpan={2}>
                      <input type="email" value={landlordEmail} onChange={e => setLandlordEmail(e.target.value)} className={subInputCls} placeholder="Opcional" />
                    </SubField>
                  </div>
                </NewEntityBanner>
              )}

              {/* ── Inquilino ───────────────────────────────────────────── */}
              <Field label="Inquilino">
                <EntityCombo
                  value={tenantInput}
                  onChange={(text, pickedId) => { setTenantInput(text); setTenantPickedId(pickedId) }}
                  options={tenantOptions}
                  placeholder="Buscá o escribí nombre nuevo…"
                />
              </Field>

              {tenantIsNew && (
                <NewEntityBanner label="inquilino" name={tenantInput.trim()}>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <SubField label="DNI">
                      <input type="text" value={tenantDni}   onChange={e => setTenantDni(e.target.value)}   className={subInputCls} placeholder="Opcional" />
                    </SubField>
                    <SubField label="Teléfono">
                      <input type="tel"  value={tenantPhone} onChange={e => setTenantPhone(e.target.value)} className={subInputCls} placeholder="Opcional" />
                    </SubField>
                    <SubField label="Email" colSpan={2}>
                      <input type="email" value={tenantEmail} onChange={e => setTenantEmail(e.target.value)} className={subInputCls} placeholder="Opcional" />
                    </SubField>
                  </div>
                </NewEntityBanner>
              )}

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
                  <input type="number" value={rent} onChange={e => setRent(e.target.value)} placeholder="500000" min={1} step={100} className={inputCls} />
                </Field>
                <Field label="Comisión (%)">
                  <input type="number" value={pct} onChange={e => setPct(e.target.value)} min={0} max={100} step={0.1} className={inputCls} />
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
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────

const inputCls    = 'w-full h-9 px-2 rounded border border-gray-300 bg-white text-[13px] outline-none focus:border-info transition-colors'
const selectCls   = 'w-full h-9 px-2 rounded border border-gray-300 bg-white text-[13px] outline-none focus:border-info transition-colors'
const subInputCls = 'w-full h-8 px-2 rounded border border-gray-300 bg-white text-[12px] outline-none focus:border-info transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-cap block mb-1">{label}</span>
      {children}
    </label>
  )
}

function SubField({ label, children, colSpan }: { label: string; children: React.ReactNode; colSpan?: number }) {
  return (
    <label className={`block ${colSpan === 2 ? 'col-span-2' : ''}`}>
      <span className="text-[10px] uppercase tracking-wider text-gray-600 block mb-0.5">{label}</span>
      {children}
    </label>
  )
}

// ── New-entity warning banner ──────────────────────────────────────────────
// Shown directly under the autocomplete field when the typed name doesn't
// match any existing record. Contains a clear "Nuevo X detectado" message
// plus optional contact-detail fields the encargada can fill in.
function NewEntityBanner({
  label, name, children,
}: { label: string; name: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-warn/60 bg-warn/10 rounded p-3 -mt-1">
      <p className="text-[12px] text-ink font-medium flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-warn" />
        Nuevo {label} detectado{name ? `: «${name}»` : ''}
      </p>
      <p className="text-[11px] text-slate-dark mt-1 leading-snug">
        Al crear el contrato se va a registrar este {label} como nuevo. Si tenés los datos a mano cargalos ahora, sino los podés completar después desde la ficha.
      </p>
      {children}
    </div>
  )
}

// ── EntityCombo: autocomplete input with always-visible dropdown ────────
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

  // Show the dropdown whenever open is true — even with zero matches —
  // because the "no exact match" warning row needs to be visible.
  const showDropdown = open && (filtered.length > 0 || value.trim().length > 0)

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
      {showDropdown && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-gray-300 rounded shadow-lg max-h-[220px] overflow-y-auto"
        >
          {filtered.length === 0 && value.trim() && (
            <li className="px-3 py-1.5 text-[12px] text-gray-500 italic">
              Sin coincidencias en la lista existente.
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
          {!exact && value.trim() && (
            <li className="px-3 py-1.5 text-[11.5px] text-ink bg-warn/15 border-t border-gray-200 font-medium">
              ⚠ «{value.trim()}» no existe — se creará como nuevo al guardar
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
