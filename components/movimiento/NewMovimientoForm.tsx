'use client'

import { useRef, useState, useTransition } from 'react'
import { createTransaction } from '@/lib/transaction/actions'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'
import { FormField } from '@/components/ui/FormField'
import { FormError } from '@/components/ui/FormError'
import { FormFooter, SavedIndicator, DELAYED_HINT_CREATE } from '@/components/ui/FormFooter'

interface TypeOption {
  code:      string
  label:     string
  direction: 'IN' | 'OUT'
}

interface ContractOption {
  id:        string
  label:     string
}

interface BankAccountOption {
  id:    string
  label: string
}

interface Props {
  types:        TypeOption[]
  contracts:    ContractOption[]
  bankAccounts: BankAccountOption[]
  defaultPeriod: string
}

export function NewMovimientoForm({ types, contracts, bankAccounts, defaultPeriod }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const formRef                    = useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await createTransaction(formData)
      if (res && !res.ok) setError(res.error ?? 'Error al guardar')
      // success path redirects to /movimientos via the action
    })
  }

  // Group types by direction for the dropdown
  const inTypes  = types.filter(t => t.direction === 'IN').sort((a, b) => a.label.localeCompare(b.label))
  const outTypes = types.filter(t => t.direction === 'OUT').sort((a, b) => a.label.localeCompare(b.label))

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="label-cap">Tipo<span className="text-danger ml-0.5">*</span></span>
        <select
          name="type_code"
          required
          defaultValue=""
          className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors"
        >
          <option value="" disabled>Elegí un tipo…</option>
          <optgroup label="Ingresos">
            {inTypes.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
          </optgroup>
          <optgroup label="Egresos">
            {outTypes.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
          </optgroup>
        </select>
      </label>

      <FormField name="amount"    label="Monto"  type="number" step="0.01" required defaultValue="" placeholder="125000.00" />
      <FormField name="period"    label="Período (primer día del mes)" type="date" required defaultValue={defaultPeriod} />

      <FormField name="bank_date" label="Fecha bancaria" type="date" defaultValue="" />

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">Contrato (opcional)</span>
        <select
          name="contract_id"
          defaultValue=""
          className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors"
        >
          <option value="">— Sin contrato —</option>
          {contracts.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">Cuenta bancaria (opcional)</span>
        <select
          name="bank_account_id"
          defaultValue=""
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
          rows={2}
          placeholder="Notas, referencia bancaria, destino (ADM_GALICIA / ADM_FRANCES_50_9 / ADM_FRANCES_51_6) si corresponde…"
          className="px-3 py-2 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors resize-y"
        />
      </label>

      <FormError message={error} />

      <FormFooter>
        <SavedIndicator savedAt={null} idleHint={DELAYED_HINT_CREATE} />
        <DelayedActionButton
          variant="primary"
          label="Crear movimiento"
          pendingLabel="Creando…"
          onConfirm={() => formRef.current?.requestSubmit()}
          pending={pending}
        />
      </FormFooter>
    </form>
  )
}
