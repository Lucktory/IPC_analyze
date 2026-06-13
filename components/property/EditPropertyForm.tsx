'use client'

import { useRef, useState, useTransition } from 'react'
import { createProperty, updateProperty, deleteProperty } from '@/lib/property/actions'
import type { PropertyDetail } from '@/lib/property/queries'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'
import { FormField }           from '@/components/ui/FormField'
import { FormError }           from '@/components/ui/FormError'
import { FormFooter, SavedIndicator, DELAYED_HINT_CREATE } from '@/components/ui/FormFooter'

const TYPE_OPTIONS = [
  { value: 'vivienda', label: 'Vivienda' },
  { value: 'local',    label: 'Local' },
  { value: 'cochera',  label: 'Cochera' },
  { value: 'oficina',  label: 'Oficina' },
  { value: 'deposito', label: 'Depósito' },
]

interface EditPropertyFormProps {
  /** Omit for create mode. */
  property?:      PropertyDetail
  contractCount?: number
}

export function EditPropertyForm({ property, contractCount = 0 }: EditPropertyFormProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const [savedAt, setSavedAt]      = useState<Date | null>(null)
  const formRef                    = useRef<HTMLFormElement>(null)
  const isCreate = !property

  function handleSubmit(formData: FormData) {
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

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
  )
}
