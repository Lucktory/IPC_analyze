'use client'

import { useState, useTransition } from 'react'
import { updateTenant, deleteTenant } from '@/lib/tenant/actions'
import type { TenantDetail } from '@/lib/tenant/queries'

interface EditTenantFormProps {
  tenant: TenantDetail
}

export function EditTenantForm({ tenant }: EditTenantFormProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const [savedAt, setSavedAt]      = useState<Date | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
      if (res && !res.ok) {
        setError(res.error ?? 'Error al eliminar')
        setConfirmDelete(false)
      }
      // On success the server redirects to /inquilinos — nothing else to do
    })
  }

  // Hard delete is only safe when there are no contracts (DB will RESTRICT
  // anyway, but disabling the button avoids a wasted round-trip).
  const canDelete = tenant.contractCount === 0

  return (
    <form action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <Field name="name"  label="Nombre" defaultValue={tenant.name} required wide />
      <Field name="dni"   label="DNI"    defaultValue={tenant.dni   ?? ''} />
      <Field name="phone" label="Teléfono" defaultValue={tenant.phone ?? ''} placeholder="+54 9 11 1234 5678" />
      <Field name="email" label="Correo electrónico" type="email" defaultValue={tenant.email ?? ''} placeholder="inquilino@dominio.com" />

      {error && (
        <p className="sm:col-span-2 text-[13px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="sm:col-span-2 flex items-center justify-between pt-2 flex-wrap gap-3">
        <p className="text-[12px] text-slate">
          {savedAt
            ? <span className="text-success">✓ Guardado {savedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
            : 'Los cambios se guardan al confirmar.'}
        </p>
        <div className="flex items-center gap-2">
          {confirmDelete ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={pending}
                className="px-3 py-2 text-[12px] text-slate hover:text-ink transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="bg-danger text-paper px-4 py-2 rounded text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? 'Eliminando…' : 'Confirmar eliminación'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={pending || !canDelete}
              title={canDelete ? 'Eliminar inquilino' : `Tiene ${tenant.contractCount} contrato(s) asociado(s) — no se puede eliminar`}
              className="px-3 py-2 text-[12px] text-danger hover:bg-danger/10 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Eliminar
            </button>
          )}
          <button
            type="submit"
            disabled={pending}
            className="bg-ink text-paper px-4 py-2 rounded text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </form>
  )
}

interface FieldProps {
  name:         string
  label:        string
  defaultValue: string
  required?:    boolean
  placeholder?: string
  type?:        string
  wide?:        boolean
}

function Field({ name, label, defaultValue, required, placeholder, type, wide }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="label-cap">{label}{required && <span className="text-danger ml-0.5">*</span>}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        type={type ?? 'text'}
        className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors"
      />
    </label>
  )
}
