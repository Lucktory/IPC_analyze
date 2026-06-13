'use client'

import { useRef, useState, useTransition } from 'react'
import { createLandlord, updateLandlord, deleteLandlord } from '@/lib/landlord/actions'
import type { LandlordDetail } from '@/lib/landlord/queries'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'
import { FormField }           from '@/components/ui/FormField'
import { FormError }           from '@/components/ui/FormError'
import { FormFooter, SavedIndicator, DELAYED_HINT_CREATE } from '@/components/ui/FormFooter'

interface EditLandlordFormProps {
  /** Omit for create mode. */
  landlord?:       LandlordDetail
  propertyCount?:  number
  contractCount?:  number
}

export function EditLandlordForm({ landlord, propertyCount = 0, contractCount = 0 }: EditLandlordFormProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const [savedAt, setSavedAt]      = useState<Date | null>(null)
  const formRef                    = useRef<HTMLFormElement>(null)
  const isCreate = !landlord

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = isCreate
        ? await createLandlord(formData)
        : await updateLandlord(landlord!.id, formData)
      if (res && !res.ok) {
        setError(res.error ?? 'Error al guardar')
        return
      }
      if (!isCreate) setSavedAt(new Date())
    })
  }

  function handleDelete() {
    if (!landlord) return
    setError(null)
    startTransition(async () => {
      const res = await deleteLandlord(landlord.id)
      if (res && !res.ok) setError(res.error ?? 'Error al eliminar')
    })
  }

  const canDelete = !isCreate && propertyCount === 0 && contractCount === 0

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <FormField name="name"        label="Nombre del propietario" defaultValue={landlord?.name ?? ''} required wide />
      <FormField name="dni_or_cuit" label="CUIT / DNI"             defaultValue={landlord?.dniOrCuit ?? ''} placeholder="20-12345678-9" />
      <FormField name="phone"       label="Teléfono"               defaultValue={landlord?.phone ?? ''}     placeholder="+54 9 11 1234 5678" />
      <FormField name="email"       label="Correo electrónico"     defaultValue={landlord?.email ?? ''}     placeholder="propietario@dominio.com" type="email" wide />
      <FormField name="notes"       label="Notas internas"         defaultValue={landlord?.notes ?? ''}     textarea wide />

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
              title={canDelete ? 'Eliminar propietario' : `Tiene ${propertyCount} propiedad(es) y ${contractCount} contrato(s) — no se puede eliminar`}
            />
          )}
          <DelayedActionButton
            variant="primary"
            label={isCreate ? 'Crear propietario' : 'Guardar cambios'}
            pendingLabel={isCreate ? 'Creando…' : 'Guardando…'}
            onConfirm={() => formRef.current?.requestSubmit()}
            pending={pending}
          />
        </div>
      </FormFooter>
    </form>
  )
}
