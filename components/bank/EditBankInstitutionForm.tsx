'use client'

import { useRef, useState, useTransition } from 'react'
import {
  createBankInstitution,
  updateBankInstitution,
  deleteBankInstitution,
} from '@/lib/bank/actions'
import type { BankInstitutionDetail } from '@/lib/bank/queries'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'

interface Props {
  /** When editing, pass the institution. When creating, omit. */
  bank?:         BankInstitutionDetail
  /** Account count — only relevant on edit. Used to disable delete. */
  accountCount?: number
}

export function EditBankInstitutionForm({ bank, accountCount = 0 }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const [savedAt, setSavedAt]      = useState<Date | null>(null)
  const formRef                    = useRef<HTMLFormElement>(null)

  const isCreate = !bank

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = isCreate
        ? await createBankInstitution(formData)
        : await updateBankInstitution(bank!.id, formData)
      if (res && !res.ok) {
        setError(res.error ?? 'Error al guardar')
        return
      }
      if (!isCreate) setSavedAt(new Date())
      // createBankInstitution redirects on success — nothing else to do
    })
  }

  function handleDelete() {
    if (!bank) return
    setError(null)
    startTransition(async () => {
      const res = await deleteBankInstitution(bank.id)
      if (res && !res.ok) {
        setError(res.error ?? 'Error al eliminar')
      }
    })
  }

  const canDelete = !isCreate && accountCount === 0

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {/* Identification */}
      <Field name="name"       label="Nombre" required defaultValue={bank?.name ?? ''} wide placeholder="Banco Galicia" />
      <Field name="short_code" label="Código corto" defaultValue={bank?.shortCode ?? ''} placeholder="GAL" />

      <Heading text="Comisiones (Pampa paga)" />

      <Field name="monthly_fee"        label="Mantenimiento mensual ($)" type="number" step="0.01" defaultValue={bank?.monthlyFee ?? ''} placeholder="4500.00" />
      <Field name="transfer_fee_pct"   label="Comisión transferencia (%)" type="number" step="0.01" max="100" defaultValue={bank?.transferFeePct ?? ''} placeholder="0.5" />
      <Field name="transfer_fee_fixed" label="Comisión transferencia fija ($)" type="number" step="0.01" defaultValue={bank?.transferFeeFixed ?? ''} placeholder="250.00" />

      <Heading text="Contacto comercial" />

      <Field name="contact_name"  label="Nombre" defaultValue={bank?.contactName ?? ''} placeholder="María López" />
      <Field name="contact_phone" label="Teléfono" defaultValue={bank?.contactPhone ?? ''} placeholder="+54 9 11 1234 5678" />
      <Field name="contact_email" label="Email" type="email" defaultValue={bank?.contactEmail ?? ''} placeholder="contacto@banco.com" wide />

      <Heading text="Notas" />

      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <textarea
          name="notes"
          defaultValue={bank?.notes ?? ''}
          rows={4}
          placeholder="Promociones vigentes, condiciones especiales, contraseñas operativas, fechas de revisión…"
          className="px-3 py-2 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors resize-y"
        />
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
            : isCreate ? 'Completá los datos y confirmá. La acción se ejecuta 10s después. Tocá el botón armado para cancelar.' : 'Los cambios se ejecutan 10s después de confirmar. Tocá el botón armado para cancelar.'}
        </p>
        <div className="flex items-center gap-2">
          {!isCreate && (
            <DelayedActionButton
              variant="danger"
              label="Eliminar"
              pendingLabel="Eliminando…"
              onConfirm={handleDelete}
              pending={pending}
              disabled={!canDelete}
              title={canDelete ? 'Eliminar banco' : `Tiene ${accountCount} cuenta(s) asociada(s) — no se puede eliminar`}
            />
          )}
          <DelayedActionButton
            variant="primary"
            label={isCreate ? 'Crear banco' : 'Guardar cambios'}
            pendingLabel={isCreate ? 'Creando…' : 'Guardando…'}
            onConfirm={() => formRef.current?.requestSubmit()}
            pending={pending}
          />
        </div>
      </div>
    </form>
  )
}

interface FieldProps {
  name:         string
  label:        string
  defaultValue: string | number | null
  required?:    boolean
  placeholder?: string
  type?:        string
  step?:        string
  max?:         string
  wide?:        boolean
}

function Field({ name, label, defaultValue, required, placeholder, type, step, max, wide }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="label-cap">{label}{required && <span className="text-danger ml-0.5">*</span>}</span>
      <input
        name={name}
        type={type ?? 'text'}
        step={step}
        max={max}
        defaultValue={defaultValue ?? ''}
        required={required}
        placeholder={placeholder}
        className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors tabular-nums"
      />
    </label>
  )
}

function Heading({ text }: { text: string }) {
  return (
    <p className="sm:col-span-2 label-cap text-slate-dark border-t border-line pt-4 mt-1">{text}</p>
  )
}
