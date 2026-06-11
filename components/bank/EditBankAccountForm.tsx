'use client'

import { useRef, useState, useTransition } from 'react'
import { updateBankAccount, deleteBankAccount } from '@/lib/bank/actions'
import type { BankAccountDetail } from '@/lib/bank/queries'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'

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
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="label-cap">Alias<span className="text-danger ml-0.5">*</span></span>
        <input
          name="alias"
          defaultValue={account.alias}
          required
          placeholder="cuenta.pampa.galicia"
          className="px-3 py-2 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">Banco<span className="text-danger ml-0.5">*</span></span>
        <select
          name="bank_id"
          defaultValue={account.bankId}
          required
          className="px-3 py-2 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors"
        >
          {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">Tipo de cuenta</span>
        <select
          name="account_type"
          defaultValue={account.accountType}
          className="px-3 py-2 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors"
        >
          <option value="CA">Caja de Ahorro (CA)</option>
          <option value="CC">Cuenta Corriente (CC)</option>
          <option value="USD">Dólares (USD)</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">CBU / CVU</span>
        <input
          name="cbu"
          defaultValue={account.cbu ?? ''}
          placeholder="22 dígitos"
          maxLength={22}
          className="px-3 py-2 rounded border border-line bg-cream text-[13px] text-ink tabular-nums outline-none focus:border-ink focus:bg-paper transition-colors"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">Número de cuenta</span>
        <input
          name="account_number"
          defaultValue={account.accountNumber ?? ''}
          placeholder="Ej. 0123456/7"
          className="px-3 py-2 rounded border border-line bg-cream text-[13px] text-ink tabular-nums outline-none focus:border-ink focus:bg-paper transition-colors"
        />
      </label>

      <label className="sm:col-span-2 flex items-center gap-2 text-[13px] text-slate-dark">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={account.isActive}
          className="rounded border-line"
        />
        Cuenta activa (visible en conciliaciones)
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
            : 'Los cambios se ejecutan 10s después de confirmar. Tocá el botón armado para cancelar.'}
        </p>
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
      </div>
    </form>
  )
}
