'use client'

import { useRef, useState, useTransition } from 'react'
import { createTenant, updateTenant, deleteTenant } from '@/lib/tenant/actions'
import type { TenantDetail } from '@/lib/tenant/queries'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'
import { FormField }           from '@/components/ui/FormField'
import { FormError }           from '@/components/ui/FormError'
import { FormFooter, SavedIndicator, DELAYED_HINT_CREATE } from '@/components/ui/FormFooter'

interface EditTenantFormProps {
  /** Omit for create mode; pass for edit mode. */
  tenant?: TenantDetail
}

export function EditTenantForm({ tenant }: EditTenantFormProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const [savedAt, setSavedAt]      = useState<Date | null>(null)
  const formRef                    = useRef<HTMLFormElement>(null)
  const isCreate = !tenant

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = isCreate
        ? await createTenant(formData)
        : await updateTenant(tenant!.id, formData)
      if (res && !res.ok) {
        setError(res.error ?? 'Error al guardar')
        return
      }
      if (!isCreate) setSavedAt(new Date())
      // createTenant redirects on success — nothing else to do
    })
  }

  function handleDelete() {
    if (!tenant) return
    setError(null)
    startTransition(async () => {
      const res = await deleteTenant(tenant.id)
      if (res && !res.ok) setError(res.error ?? 'Error al eliminar')
    })
  }

  const canDelete = !isCreate && tenant!.contractCount === 0

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <FormField name="name"  label="Nombre"            defaultValue={tenant?.name  ?? ''} required wide />
      <FormField name="dni"   label="DNI"               defaultValue={tenant?.dni   ?? ''} />
      <FormField name="phone" label="Teléfono"          defaultValue={tenant?.phone ?? ''} placeholder="+54 9 11 1234 5678" />
      <FormField name="email" label="Correo electrónico" type="email" defaultValue={tenant?.email ?? ''} placeholder="inquilino@dominio.com" />

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
              title={canDelete ? 'Eliminar inquilino' : `Tiene ${tenant!.contractCount} contrato(s) asociado(s) — no se puede eliminar`}
            />
          )}
          <DelayedActionButton
            variant="primary"
            label={isCreate ? 'Crear inquilino' : 'Guardar cambios'}
            pendingLabel={isCreate ? 'Creando…' : 'Guardando…'}
            onConfirm={() => formRef.current?.requestSubmit()}
            pending={pending}
          />
        </div>
      </FormFooter>
    </form>
  )
}
