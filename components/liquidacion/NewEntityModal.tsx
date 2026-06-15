'use client'

// ============================================================================
// NewEntityModal — opens when the encargada blurs out of a Propietario or
// Inquilino cell with a name that doesn't match any existing record. Lets
// her enrich the new entity (phone, email, DNI/CUIT) before saving,
// without ever leaving the planilla.
//
// Closing options:
//   • Crear  — saves entity + links to contract via parent's onCreate cb
//   • Cancelar — discards; cell reverts to previous value (parent handles)
//   • Esc / backdrop click — same as Cancelar
//
// The modal is portal-rendered to document.body so it floats above the
// grid's overflow + sticky stacking contexts.
// ============================================================================

import { useState, useEffect, useTransition } from 'react'
import { createPortal } from 'react-dom'

export type NewEntityFields =
  | { kind: 'landlord'; name: string; dniOrCuit: string; phone: string; email: string; notes: string }
  | { kind: 'tenant';   name: string; dni: string;       phone: string; email: string }

interface Props {
  entityType:  'landlord' | 'tenant'
  defaultName: string
  onCancel:    () => void
  onCreate:    (fields: NewEntityFields) => Promise<{ ok: boolean; error?: string | null }>
}

export function NewEntityModal({ entityType, defaultName, onCancel, onCreate }: Props) {
  const entityLabel = entityType === 'landlord' ? 'propietario' : 'inquilino'

  const [name, setName]     = useState(defaultName)
  const [dni, setDni]       = useState('')
  const [phone, setPhone]   = useState('')
  const [email, setEmail]   = useState('')
  const [notes, setNotes]   = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Close on Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pending) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, pending])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const clean = name.trim()
    if (!clean) {
      setError(`El nombre del ${entityLabel} no puede estar vacío.`)
      return
    }
    startTransition(async () => {
      const fields: NewEntityFields = entityType === 'landlord'
        ? { kind: 'landlord', name: clean, dniOrCuit: dni, phone, email, notes }
        : { kind: 'tenant',   name: clean, dni,            phone, email }
      const res = await onCreate(fields)
      if (!res.ok) setError(res.error ?? 'Error al crear')
      // Parent component is responsible for closing on success.
    })
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1100] flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => !pending && onCancel()}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
      />

      <form
        onSubmit={handleSubmit}
        className="relative bg-white border border-gray-300 rounded shadow-xl w-full max-w-[460px]"
      >
        <div className="px-5 py-3 border-b border-gray-200">
          <h2 className="font-display text-[15px] font-medium text-ink">
            Nuevo {entityLabel}
          </h2>
          <p className="text-[11.5px] text-gray-500 mt-0.5">
            Completá los datos opcionales si los tenés a mano. Podés editarlos después desde la ficha.
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <Field label="Nombre" required>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={entityType === 'landlord' ? 'DNI / CUIT' : 'DNI'}>
              <input
                type="text"
                value={dni}
                onChange={e => setDni(e.target.value)}
                placeholder="Opcional"
                className={inputCls}
              />
            </Field>
            <Field label="Teléfono">
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Opcional"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Opcional"
              className={inputCls}
            />
          </Field>

          {entityType === 'landlord' && (
            <Field label="Notas">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Opcional"
                rows={2}
                className={`${inputCls} min-h-[60px] py-1.5`}
              />
            </Field>
          )}

          {error && (
            <p className="text-[11.5px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
          <button
            type="button"
            onClick={onCancel}
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
            {pending ? 'Creando…' : `Crear ${entityLabel}`}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

const inputCls = 'w-full h-9 px-2 rounded border border-gray-300 bg-white text-[13px] outline-none focus:border-info transition-colors'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-cap block mb-1">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </span>
      {children}
    </label>
  )
}
