'use client'

import { useRef, useState, useTransition } from 'react'
import { updateProperty, deleteProperty } from '@/lib/property/actions'
import type { PropertyDetail } from '@/lib/property/queries'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'

const TYPE_OPTIONS = [
  { value: 'vivienda', label: 'Vivienda' },
  { value: 'local',    label: 'Local' },
  { value: 'cochera',  label: 'Cochera' },
  { value: 'oficina',  label: 'Oficina' },
  { value: 'deposito', label: 'Depósito' },
]

interface EditPropertyFormProps {
  property:      PropertyDetail
  contractCount: number
}

export function EditPropertyForm({ property, contractCount }: EditPropertyFormProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const [savedAt, setSavedAt]      = useState<Date | null>(null)
  const formRef                    = useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await updateProperty(property.id, formData)
      if (!res.ok) {
        setError(res.error ?? 'Error al guardar')
        return
      }
      setSavedAt(new Date())
    })
  }

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const res = await deleteProperty(property.id)
      if (res && !res.ok) setError(res.error ?? 'Error al eliminar')
    })
  }

  const canDelete = contractCount === 0

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="label-cap">Dirección<span className="text-danger ml-0.5">*</span></span>
        <input
          name="address"
          defaultValue={property.address}
          required
          placeholder="Av. Belgrano 1234, 2°B"
          className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">Tipo</span>
        <select
          name="property_type"
          defaultValue={property.propertyType}
          className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors"
        >
          {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>

      {error && (
        <p className="sm:col-span-2 text-[13px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="sm:col-span-2 flex items-center justify-between pt-2 flex-wrap gap-3">
        <p className="text-[12px] text-slate">
          {savedAt
            ? <span className="text-success">✓ Guardado {savedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
            : 'Los cambios se ejecutan 10s después de confirmar. Tocá el botón armado para cancelar.'}
        </p>
        <div className="flex items-center gap-2">
          <DelayedActionButton
            variant="danger"
            label="Eliminar"
            pendingLabel="Eliminando…"
            onConfirm={handleDelete}
            pending={pending}
            disabled={!canDelete}
            title={canDelete ? 'Eliminar propiedad' : `Tiene ${contractCount} contrato(s) asociado(s) — no se puede eliminar`}
          />
          <DelayedActionButton
            variant="primary"
            label="Guardar cambios"
            pendingLabel="Guardando…"
            onConfirm={() => formRef.current?.requestSubmit()}
            pending={pending}
          />
        </div>
      </div>
    </form>
  )
}
