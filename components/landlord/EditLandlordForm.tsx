'use client'

import { useState, useTransition } from 'react'
import { updateLandlord } from '@/lib/landlord/actions'
import type { LandlordDetail } from '@/lib/landlord/queries'

interface EditLandlordFormProps {
  landlord: LandlordDetail
}

export function EditLandlordForm({ landlord }: EditLandlordFormProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const [savedAt, setSavedAt]      = useState<Date | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await updateLandlord(landlord.id, formData)
      if (!res.ok) {
        setError(res.error ?? 'Error al guardar')
        return
      }
      setSavedAt(new Date())
    })
  }

  return (
    <form action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <Field
        name="name"
        label="Nombre del propietario"
        defaultValue={landlord.name}
        required
        wide
      />

      <Field
        name="dni_or_cuit"
        label="CUIT / DNI"
        defaultValue={landlord.dniOrCuit ?? ''}
        placeholder="20-12345678-9"
      />

      <Field
        name="phone"
        label="Teléfono"
        defaultValue={landlord.phone ?? ''}
        placeholder="+54 9 11 1234 5678"
      />

      <Field
        name="email"
        label="Correo electrónico"
        type="email"
        defaultValue={landlord.email ?? ''}
        placeholder="propietario@dominio.com"
        wide
      />

      <Field
        name="notes"
        label="Notas internas"
        defaultValue={landlord.notes ?? ''}
        textarea
        wide
      />

      {error && (
        <p className="sm:col-span-2 text-[13px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="sm:col-span-2 flex items-center justify-between pt-2">
        <p className="text-[12px] text-slate">
          {savedAt
            ? <span className="text-success">✓ Guardado {savedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
            : 'Los cambios se guardan al confirmar.'}
        </p>
        <button
          type="submit"
          disabled={pending}
          className="bg-ink text-paper px-4 py-2 rounded text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </button>
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
  textarea?:    boolean
}

function Field({ name, label, defaultValue, required, placeholder, type, wide, textarea }: FieldProps) {
  const Tag = textarea ? 'textarea' as const : 'input' as const
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="label-cap">{label}{required && <span className="text-danger ml-0.5">*</span>}</span>
      <Tag
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        type={Tag === 'input' ? (type ?? 'text') : undefined}
        rows={textarea ? 3 : undefined}
        className="h-10 sm:h-auto px-3 py-2 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors resize-none"
      />
    </label>
  )
}
