'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTransaction, deleteTransaction } from '@/lib/transaction/actions'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'
import { FormField } from '@/components/ui/FormField'
import { FormError } from '@/components/ui/FormError'
import { FormFooter, SavedIndicator } from '@/components/ui/FormFooter'

interface TypeOption       { code: string; label: string; direction: 'IN' | 'OUT' }
interface ContractOption   { id: string; label: string }
interface BankAccountOption { id: string; label: string }

interface MovimientoInitial {
  id:             string
  typeCode:       string
  amount:         number
  period:         string
  bankDate:       string | null
  contractId:     string | null
  bankAccountId:  string | null
  description:    string | null
}

interface Props {
  initial:      MovimientoInitial
  types:        TypeOption[]
  contracts:    ContractOption[]
  bankAccounts: BankAccountOption[]
}

export function EditMovimientoForm({ initial, types, contracts, bankAccounts }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const [savedAt, setSavedAt]      = useState<Date | null>(null)
  const formRef                    = useRef<HTMLFormElement>(null)
  const router                     = useRouter()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await updateTransaction(initial.id, formData)
      if (!res.ok) {
        setError(res.error ?? 'Error al guardar')
        return
      }
      setSavedAt(new Date())
      router.refresh()
    })
  }

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const res = await deleteTransaction(initial.id)
      if (res && !res.ok) setError(res.error ?? 'Error al eliminar')
    })
  }

  const inTypes  = types.filter(t => t.direction === 'IN').sort((a, b) => a.label.localeCompare(b.label))
  const outTypes = types.filter(t => t.direction === 'OUT').sort((a, b) => a.label.localeCompare(b.label))

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="label-cap">Tipo<span className="text-danger ml-0.5">*</span></span>
        <select
          name="type_code"
          required
          defaultValue={initial.typeCode}
          className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors"
        >
          <optgroup label="Ingresos">
            {inTypes.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
          </optgroup>
          <optgroup label="Egresos">
            {outTypes.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
          </optgroup>
        </select>
      </label>

      <FormField name="amount"    label="Monto"  type="number" step="0.01" required defaultValue={initial.amount} />
      <FormField name="period"    label="Período (primer día del mes)" type="date" required defaultValue={initial.period} />
      <FormField name="bank_date" label="Fecha bancaria" type="date" defaultValue={initial.bankDate ?? ''} />

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">Contrato</span>
        <select
          name="contract_id"
          defaultValue={initial.contractId ?? ''}
          className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors"
        >
          <option value="">— Sin contrato —</option>
          {contracts.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="label-cap">Cuenta bancaria</span>
        <select
          name="bank_account_id"
          defaultValue={initial.bankAccountId ?? ''}
          className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors"
        >
          <option value="">— Sin cuenta específica —</option>
          {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="label-cap">Descripción</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={initial.description ?? ''}
          placeholder="Notas, referencia bancaria, destino (ADM_GALICIA / ADM_FRANCES_50_9 / ADM_FRANCES_51_6)…"
          className="px-3 py-2 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors resize-y"
        />
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
