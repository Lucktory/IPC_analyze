'use client'

// ============================================================================
// EditPropertyForm — full property editor (Phase 11).
//
// Three sections (everything visible, no tabs — same principle as the
// New Contract modal):
//
//   1. DATOS — address + property_type (legacy editable fields).
//   2. PROPIETARIOS — multi-owner editor with live Σ=100 indicator.
//       Reuses EntityRow + EntityCombo + SumPill from the shared registry.
//       Saves through updatePropertyOwners() — validates against the same
//       isPctSum100() the server uses.
//   3. CONTRATO ACTIVO — only rendered when the property has an active
//       contract. Edits the contract's tenants (with share %) and the
//       depósito en garantía (amount + status). Empty / hidden when the
//       property is vacant.
//
// Sub-sections save independently so a partial edit doesn't lose work.
// Each has its own Save button + saved-at indicator.
// ============================================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createProperty,
  updateProperty,
  deleteProperty,
  updatePropertyOwners,
  fetchPropertyOwners,
} from '@/lib/property/actions'
import {
  updateContractTenants,
  updateContractDeposit,
} from '@/lib/contract/actions'
import { createLandlordStandalone } from '@/lib/landlord/actions'
import { createTenantStandalone }   from '@/lib/tenant/actions'
import type { PropertyDetail, PropertyContract } from '@/lib/property/queries'
import type { LandlordOption } from '@/lib/landlord/queries'
import type { TenantOption }   from '@/lib/tenant/queries'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'
import { FormField }           from '@/components/ui/FormField'
import { FormError }           from '@/components/ui/FormError'
import { FormFooter, SavedIndicator, DELAYED_HINT_CREATE } from '@/components/ui/FormFooter'
import {
  Field,
  SectionHeader,
  SumPill,
  EntityRow,
} from '@/components/shared/forms'
import { NewEntityModal, type NewEntityFields } from '@/components/liquidacion/NewEntityModal'
import { isPctSum100, makeRowId, pctSum } from '@/lib/shared'

const TYPE_OPTIONS = [
  { value: 'vivienda', label: 'Vivienda' },
  { value: 'local',    label: 'Local' },
  { value: 'cochera',  label: 'Cochera' },
  { value: 'oficina',  label: 'Oficina' },
  { value: 'deposito', label: 'Depósito' },
]
const DEPOSIT_STATUS_LABEL: Record<string, string> = {
  held:            'En garantía con el propietario',
  partially_used:  'Parcialmente usado',
  refunded:        'Devuelto al inquilino',
}

interface OwnerRow {
  rowId:    string
  pickedId: string | null
  input:    string
  pct:      string
}
interface TenantRow {
  rowId:    string
  pickedId: string | null
  input:    string
  pct:      string
}

interface Props {
  /** Omit for create mode (used by /propiedades/nuevo). */
  property?:        PropertyDetail
  contractCount?:   number
  /** Phase 11 only-render-when-rented props. */
  activeContract?:  PropertyContract | null
  landlordOptions?: LandlordOption[]
  tenantOptions?:   TenantOption[]
}

export function EditPropertyForm({
  property,
  contractCount     = 0,
  activeContract    = null,
  landlordOptions   = [],
  tenantOptions     = [],
}: Props) {
  const router = useRouter()
  const isCreate = !property

  // ── Section 1: address + tipo (legacy submit) ──────────────────────────
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const [savedAt, setSavedAt]      = useState<Date | null>(null)
  const formRef                    = useRef<HTMLFormElement>(null)

  function handleDatosSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = isCreate
        ? await createProperty(formData)
        : await updateProperty(property!.id, formData)
      if (res && !res.ok) {
        setError(res.error ?? 'Error al guardar')
        return
      }
      if (!isCreate) setSavedAt(new Date())
    })
  }

  function handleDelete() {
    if (!property) return
    setError(null)
    startTransition(async () => {
      const res = await deleteProperty(property.id)
      if (res && !res.ok) setError(res.error ?? 'Error al eliminar')
    })
  }

  const canDelete = !isCreate && contractCount === 0

  // ── Section 2: Propietarios editor ─────────────────────────────────────
  const [ownerRows, setOwnerRows] = useState<OwnerRow[]>(() =>
    (property?.landlords ?? []).map(l => ({
      rowId:    makeRowId(),
      pickedId: l.id,
      input:    l.name,
      pct:      String(l.ownershipPct),
    })),
  )
  const [landlords, setLandlords] = useState<LandlordOption[]>(landlordOptions)
  useEffect(() => { setLandlords(landlordOptions) }, [landlordOptions])

  const [creatingLandlord, setCreatingLandlord] = useState<{ rowId: string; name: string } | null>(null)
  const [ownersPending, startOwnersTransition]  = useTransition()
  const [ownersError, setOwnersError]           = useState<string | null>(null)
  const [ownersSavedAt, setOwnersSavedAt]       = useState<Date | null>(null)

  const ownerPcts   = ownerRows.map(r => r.pct)
  const ownerSumOk  = isPctSum100(ownerPcts)

  function addOwnerRow() {
    setOwnerRows(prev => [...prev, { rowId: makeRowId(), pickedId: null, input: '', pct: '0' }])
  }
  function removeOwnerRow(rowId: string) {
    setOwnerRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.rowId !== rowId))
  }
  function patchOwnerRow(rowId: string, patch: Partial<OwnerRow>) {
    setOwnerRows(prev => prev.map(r => r.rowId === rowId ? { ...r, ...patch } : r))
  }

  function handleSaveOwners() {
    if (!property) return
    setOwnersError(null)
    if (ownerRows.some(r => !r.pickedId)) {
      setOwnersError('Todos los propietarios deben estar seleccionados o creados.')
      return
    }
    if (!ownerSumOk) {
      setOwnersError(`Los porcentajes deben sumar 100% (suman ${pctSum(ownerPcts).toFixed(2)}%).`)
      return
    }
    startOwnersTransition(async () => {
      const res = await updatePropertyOwners(
        property.id,
        ownerRows.map(r => ({
          landlordId:   r.pickedId!,
          ownershipPct: Number(r.pct),
        })),
      )
      if (!res.ok) {
        setOwnersError(res.error ?? 'Error al guardar propietarios.')
        return
      }
      setOwnersSavedAt(new Date())
      // Pull the canonical owners back from the server so the UI matches DB.
      const fresh = await fetchPropertyOwners(property.id)
      setOwnerRows(fresh.map(o => ({
        rowId:    makeRowId(),
        pickedId: o.landlordId,
        input:    o.landlordName,
        pct:      String(o.ownershipPct),
      })))
      router.refresh()
    })
  }

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
        setOwnerRows(prev => prev.map(r =>
          r.rowId === creatingLandlord.rowId
            ? { ...r, pickedId: newId, input: fields.name }
            : r,
        ))
        setCreatingLandlord(null)
      }
      return res
    })
  }

  // ── Section 3: Contrato activo (tenants + deposit) ─────────────────────
  const hasActiveContract = !!activeContract

  const [tenantRows, setTenantRows] = useState<TenantRow[]>(() =>
    (activeContract?.tenants ?? []).map(t => ({
      rowId:    makeRowId(),
      pickedId: t.id,
      input:    t.name,
      pct:      String(t.sharePct),
    })),
  )
  const [tenants, setTenants] = useState<TenantOption[]>(tenantOptions)
  useEffect(() => { setTenants(tenantOptions) }, [tenantOptions])

  const [creatingTenant, setCreatingTenant]   = useState<{ rowId: string; name: string } | null>(null)
  const [tenantsPending, startTenantsTrans]   = useTransition()
  const [tenantsError, setTenantsError]       = useState<string | null>(null)
  const [tenantsSavedAt, setTenantsSavedAt]   = useState<Date | null>(null)

  const tenantPcts  = tenantRows.map(r => r.pct)
  const tenantSumOk = isPctSum100(tenantPcts)

  function addTenantRow() {
    setTenantRows(prev => [...prev, { rowId: makeRowId(), pickedId: null, input: '', pct: '0' }])
  }
  function removeTenantRow(rowId: string) {
    setTenantRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.rowId !== rowId))
  }
  function patchTenantRow(rowId: string, patch: Partial<TenantRow>) {
    setTenantRows(prev => prev.map(r => r.rowId === rowId ? { ...r, ...patch } : r))
  }

  function handleSaveTenants() {
    if (!activeContract) return
    setTenantsError(null)
    if (tenantRows.some(r => !r.pickedId)) {
      setTenantsError('Todos los inquilinos deben estar seleccionados o creados.')
      return
    }
    if (!tenantSumOk) {
      setTenantsError(`Los porcentajes deben sumar 100% (suman ${pctSum(tenantPcts).toFixed(2)}%).`)
      return
    }
    startTenantsTrans(async () => {
      const res = await updateContractTenants(
        activeContract.id,
        tenantRows.map(r => ({
          tenantId: r.pickedId!,
          sharePct: Number(r.pct),
        })),
      )
      if (!res.ok) {
        setTenantsError(res.error ?? 'Error al guardar inquilinos.')
        return
      }
      setTenantsSavedAt(new Date())
      router.refresh()
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

  // Deposit sub-form
  const [depositAmount, setDepositAmount] = useState<string>(
    activeContract?.depositAmount != null ? String(activeContract.depositAmount) : '',
  )
  const [depositStatus, setDepositStatus] = useState<string>(activeContract?.depositStatus ?? 'held')
  const [depositPending, startDepositTrans] = useTransition()
  const [depositError, setDepositError]     = useState<string | null>(null)
  const [depositSavedAt, setDepositSavedAt] = useState<Date | null>(null)

  function handleSaveDeposit() {
    if (!activeContract) return
    setDepositError(null)
    const trimmed = depositAmount.trim()
    const parsed: number | null = trimmed === '' ? null : Number(trimmed)
    if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
      setDepositError('Monto inválido.')
      return
    }
    startDepositTrans(async () => {
      const res = await updateContractDeposit(activeContract.id, parsed, depositStatus)
      if (!res.ok) {
        setDepositError(res.error ?? 'Error al guardar depósito.')
        return
      }
      setDepositSavedAt(new Date())
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      {/* ── Section 1: DATOS ────────────────────────────────────────── */}
      <section>
        <SectionHeader label="Datos de la propiedad" />
        <form ref={formRef} action={handleDatosSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField name="address" label="Dirección" defaultValue={property?.address ?? ''} required wide placeholder="Av. Belgrano 1234, 2°B" />

          <label className="flex flex-col gap-1.5">
            <span className="label-cap">Tipo</span>
            <select
              name="property_type"
              defaultValue={property?.propertyType ?? 'vivienda'}
              className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors"
            >
              {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>

          <FormError message={error} />

          <FormFooter>
            <SavedIndicator savedAt={savedAt} idleHint={isCreate ? DELAYED_HINT_CREATE : undefined} />
            <div className="flex items-center gap-2">
              {!isCreate && (
                <DelayedActionButton
                  variant="danger"
                  label="Eliminar"
                  pendingLabel="Eliminando…"
                  onConfirm={handleDelete}
                  pending={pending}
                  disabled={!canDelete}
                  title={canDelete ? 'Eliminar propiedad' : `Tiene ${contractCount} contrato(s) asociado(s) — no se puede eliminar`}
                />
              )}
              <DelayedActionButton
                variant="primary"
                label={isCreate ? 'Crear propiedad' : 'Guardar cambios'}
                pendingLabel={isCreate ? 'Creando…' : 'Guardando…'}
                onConfirm={() => formRef.current?.requestSubmit()}
                pending={pending}
              />
            </div>
          </FormFooter>
        </form>
      </section>

      {/* ── Section 2: PROPIETARIOS (only when editing, not on create) ─ */}
      {!isCreate && (
        <section>
          <SectionHeader
            label="Propietarios"
            rightAdornment={<SumPill values={ownerPcts} />}
          />
          <div className="space-y-2">
            {ownerRows.length === 0 && (
              <p className="text-[12px] text-slate/60 italic">
                Esta propiedad todavía no tiene propietarios cargados.
              </p>
            )}
            {ownerRows.map(row => (
              <EntityRow
                key={row.rowId}
                input={row.input}
                pickedId={row.pickedId}
                pct={row.pct}
                options={landlords}
                entityLabel="propietario"
                placeholder="Buscá o tocá «+ Crear»…"
                onChange={(text, pickedId) => patchOwnerRow(row.rowId, { input: text, pickedId })}
                onPctChange={v => patchOwnerRow(row.rowId, { pct: v })}
                onRequestCreate={(name) => setCreatingLandlord({ rowId: row.rowId, name })}
                onRemove={ownerRows.length > 1 ? () => removeOwnerRow(row.rowId) : undefined}
              />
            ))}
            <button
              type="button"
              onClick={addOwnerRow}
              className="text-[12px] text-info hover:underline font-medium"
            >
              + Agregar propietario
            </button>
          </div>

          {ownersError && <FormError message={ownersError} />}

          <FormFooter>
            <SavedIndicator savedAt={ownersSavedAt} />
            <DelayedActionButton
              variant="primary"
              label="Guardar propietarios"
              pendingLabel="Guardando…"
              onConfirm={handleSaveOwners}
              pending={ownersPending}
            />
          </FormFooter>
        </section>
      )}

      {/* ── Section 3: CONTRATO ACTIVO (only when rented) ─────────── */}
      {!isCreate && hasActiveContract && activeContract && (
        <section>
          <SectionHeader
            label={`Contrato activo · alquiler $${activeContract.currentRent.toLocaleString('es-AR')}`}
          />

          {/* Tenants editor */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="label-cap text-slate">Inquilinos</p>
              <SumPill values={tenantPcts} />
            </div>
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

            {tenantsError && <FormError message={tenantsError} />}

            <FormFooter>
              <SavedIndicator savedAt={tenantsSavedAt} />
              <DelayedActionButton
                variant="primary"
                label="Guardar inquilinos"
                pendingLabel="Guardando…"
                onConfirm={handleSaveTenants}
                pending={tenantsPending}
              />
            </FormFooter>
          </div>

          {/* Deposit editor */}
          <div>
            <p className="label-cap text-slate mb-2">Depósito en garantía</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Monto ($)">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  min={0}
                  step="any"
                  placeholder="Ej. 460000"
                  className="w-full h-9 px-2 rounded border border-gray-300 bg-white text-[13px] outline-none focus:border-info transition-colors"
                />
              </Field>
              <Field label="Estado">
                <select
                  value={depositStatus}
                  onChange={e => setDepositStatus(e.target.value)}
                  className="w-full h-9 px-2 rounded border border-gray-300 bg-white text-[13px] outline-none focus:border-info transition-colors"
                >
                  {Object.entries(DEPOSIT_STATUS_LABEL).map(([v, lbl]) => (
                    <option key={v} value={v}>{lbl}</option>
                  ))}
                </select>
              </Field>
            </div>

            {depositError && <FormError message={depositError} />}

            <FormFooter>
              <SavedIndicator savedAt={depositSavedAt} />
              <DelayedActionButton
                variant="primary"
                label="Guardar depósito"
                pendingLabel="Guardando…"
                onConfirm={handleSaveDeposit}
                pending={depositPending}
              />
            </FormFooter>
          </div>
        </section>
      )}

      {!isCreate && !hasActiveContract && (
        <section className="text-[12px] text-slate italic">
          Esta propiedad no tiene un contrato activo. Cargá uno desde la planilla
          para poder editar inquilinos y depósito.
        </section>
      )}

      {/* Inline entity-creation modals */}
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
    </div>
  )
}
