'use client'

import { useRef, useState, useTransition } from 'react'
import { updateTenant, deleteTenant } from '@/lib/tenant/actions'
import type { TenantDetail } from '@/lib/tenant/queries'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'
import { FormField }           from '@/components/ui/FormField'
import { FormError }           from '@/components/ui/FormError'
import { FormFooter, SavedIndicator } from '@/components/ui/FormFooter'

interface EditTenantFormProps {
  tenant: TenantDetail
}

export function EditTenantForm({ tenant }: EditTenantFormProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const [savedAt, setSavedAt]      = useState<Date | null>(null)
  const formRef                    = useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await updateTenant(tenant.id, formData)
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
      const res = await deleteTenant(tenant.id)
      if (res && !res.ok) setError(res.error ?? 'Error al eliminar')
      // On success the server redirects to /inquilinos — nothing else to do
    })
  }

  // Hard delete is only safe when there are no contracts (DB will RESTRICT
  // anyway, but disabling the button avoids a wasted round-trip).
  const canDelete = tenant.contractCount === 0

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <FormField name="name"  label="Nombre" defaultValue={tenant.name} required wide />
      <FormField name="dni"   label="DNI"    defaultValue={tenant.dni   ?? ''} />
      <FormField name="phone" label="Teléfono" defaultValue={tenant.phone ?? ''} placeholder="+54 9 11 1234 5678" />
      <FormField name="email" label="Correo electrónico" type="email" defaultValue={tenant.email ?? ''} placeholder="inquilino@dominio.com" />

      <FormError message={error} />

      <FormFooter>
        <SavedIndicator savedAt={savedAt} />
        <div className="flex items-center gap-2">
          <DelayedActionButton
            variant="danger"
            label="Eliminar"
            pendingLabel="Eliminando…"
            onConfirm={handleDelete}
            pending={pending}
            disabled={!canDelete}
            title={canDelete ? 'Eliminar inquilino' : `Tiene ${tenant.contractCount} contrato(s) asociado(s) — no se puede eliminar`}
          />
          <DelayedActionButton
            variant="primary"
            label="Guardar cambios"
            pendingLabel="Guardando…"
            onConfirm={() => formRef.current?.requestSubmit()}
            pending={pending}
          />
        </div>
      </FormFooter>
    </form>
  )
}
