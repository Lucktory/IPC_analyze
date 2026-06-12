'use client'

import { useRef, useState, useTransition } from 'react'
import {
  createBankInstitution,
  updateBankInstitution,
  deleteBankInstitution,
} from '@/lib/bank/actions'
import type { BankInstitutionDetail } from '@/lib/bank/queries'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'
import { FormField }           from '@/components/ui/FormField'
import { FormError }           from '@/components/ui/FormError'
import {
  FormFooter,
  SavedIndicator,
  DELAYED_HINT_CREATE,
} from '@/components/ui/FormFooter'

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
      if (res && !res.ok) setError(res.error ?? 'Error al eliminar')
    })
  }

  const canDelete = !isCreate && accountCount === 0

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {/* Identification */}
      <FormField name="name"       label="Nombre" required defaultValue={bank?.name ?? ''} wide placeholder="Banco Galicia" />
      <FormField name="short_code" label="Código corto"     defaultValue={bank?.shortCode ?? ''}        placeholder="GAL" />

      <Heading text="Comisiones (Pampa paga)" />

      <FormField name="monthly_fee"        label="Mantenimiento mensual ($)"     type="number" step="0.01" defaultValue={bank?.monthlyFee       ?? ''} placeholder="4500.00" />
      <FormField name="transfer_fee_pct"   label="Comisión transferencia (%)"    type="number" step="0.01" max="100" defaultValue={bank?.transferFeePct ?? ''} placeholder="0.5" />
      <FormField name="transfer_fee_fixed" label="Comisión transferencia fija ($)" type="number" step="0.01" defaultValue={bank?.transferFeeFixed ?? ''} placeholder="250.00" />

      <Heading text="Contacto comercial" />

      <FormField name="contact_name"  label="Nombre"   defaultValue={bank?.contactName  ?? ''} placeholder="María López" />
      <FormField name="contact_phone" label="Teléfono" defaultValue={bank?.contactPhone ?? ''} placeholder="+54 9 11 1234 5678" />
      <FormField name="contact_email" label="Email"    type="email" defaultValue={bank?.contactEmail ?? ''} placeholder="contacto@banco.com" wide />

      <Heading text="Notas" />

      <FormField
        name="notes"
        label=""
        defaultValue={bank?.notes ?? ''}
        textarea
        rows={4}
        wide
        placeholder="Promociones vigentes, condiciones especiales, contraseñas operativas, fechas de revisión…"
      />

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
      </FormFooter>
    </form>
  )
}

function Heading({ text }: { text: string }) {
  return (
    <p className="sm:col-span-2 label-cap text-slate-dark border-t border-line pt-4 mt-1">{text}</p>
  )
}
