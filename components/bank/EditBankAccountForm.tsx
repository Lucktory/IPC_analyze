'use client'

import { useRef, useState, useTransition } from 'react'
import { updateBankAccount, deleteBankAccount } from '@/lib/bank/actions'
import type { BankAccountDetail } from '@/lib/bank/queries'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'
import { FormField }           from '@/components/ui/FormField'
import { FormError }           from '@/components/ui/FormError'
import { FormFooter, SavedIndicator } from '@/components/ui/FormFooter'

interface BankOption {
  id:   string
  name: string
}

interface EditBankAccountFormProps {
  account: BankAccountDetail
  banks:   BankOption[]
}

export function EditBankAccountForm({ account, banks }: EditBankAccountFormProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const [savedAt, setSavedAt]      = useState<Date | null>(null)
  const formRef                    = useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await updateBankAccount(account.id, formData)
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
      const res = await deleteBankAccount(account.id)
      if (res && !res.ok) setError(res.error ?? 'Error al eliminar')
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <FormField name="alias" label="Alias" defaultValue={account.alias} required wide placeholder="cuenta.pampa.galicia" />

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">Banco<span className="text-danger ml-0.5">*</span></span>
        <select
          name="bank_id"
          defaultValue={account.bankId}
          required
          className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors"
        >
          {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">Tipo de cuenta</span>
        <select
          name="account_type"
          defaultValue={account.accountType}
          className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors"
        >
          <option value="CA">Caja de Ahorro (CA)</option>
          <option value="CC">Cuenta Corriente (CC)</option>
          <option value="USD">Dólares (USD)</option>
        </select>
      </label>

      <FormField name="cbu"            label="CBU / CVU"        defaultValue={account.cbu ?? ''}           placeholder="22 dígitos"   maxLength={22} />
      <FormField name="account_number" label="Número de cuenta" defaultValue={account.accountNumber ?? ''} placeholder="Ej. 0123456/7" />

      <label className="sm:col-span-2 flex items-center gap-2 text-[13px] text-slate-dark">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={account.isActive}
          className="rounded border-line"
        />
        Cuenta activa (visible en conciliaciones)
      </label>

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
            title="Si la cuenta tiene movimientos o contratos asociados, la base de datos rechazará la eliminación."
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
