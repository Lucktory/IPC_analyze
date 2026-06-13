'use client'

import { useRef, useState, useTransition } from 'react'
import { createContract } from '@/lib/contract/actions'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'
import { FormField }           from '@/components/ui/FormField'
import { FormError }           from '@/components/ui/FormError'
import { FormFooter, SavedIndicator, DELAYED_HINT_CREATE } from '@/components/ui/FormFooter'

interface SimpleOption { id: string; label: string }

interface Props {
  tenants:    SimpleOption[]
  landlords:  SimpleOption[]
  properties: SimpleOption[]
}

const CADENCE_OPTIONS = [
  { value: 'mensual',       label: 'Mensual' },
  { value: 'bimestral',     label: 'Bimestral' },
  { value: 'trimestral',    label: 'Trimestral' },
  { value: 'cuatrimestral', label: 'Cuatrimestral' },
  { value: 'semestral',     label: 'Semestral' },
  { value: 'anual',         label: 'Anual' },
]

const INDEXER_OPTIONS = [
  { value: 'IPC_GENERAL', label: 'IPC General (INDEC)' },
  { value: 'ICL',         label: 'ICL (BCRA)' },
  { value: 'CASA_PROPIA', label: 'Casa Propia' },
  { value: 'FIXED',       label: 'Fijo (sin actualización)' },
]

export function NewContractForm({ tenants, landlords, properties }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const formRef                    = useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await createContract(formData)
      if (res && !res.ok) setError(res.error ?? 'Error al guardar')
      // success path redirects to /contratos/[id]
    })
  }

  // Defaults: today + 36 months
  const today    = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const endIso   = new Date(today.getFullYear() + 3, today.getMonth(), today.getDate())
                    .toISOString().slice(0, 10)

  return (
    <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="label-cap">Propiedad<span className="text-danger ml-0.5">*</span></span>
        <select name="property_id" required defaultValue="" className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors">
          <option value="" disabled>Elegí una propiedad…</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">Inquilino principal<span className="text-danger ml-0.5">*</span></span>
        <select name="tenant_id" required defaultValue="" className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors">
          <option value="" disabled>Elegí un inquilino…</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">Propietario principal<span className="text-danger ml-0.5">*</span></span>
        <select name="landlord_id" required defaultValue="" className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors">
          <option value="" disabled>Elegí un propietario…</option>
          {landlords.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </label>

      <FormField name="current_rent" label="Alquiler inicial ($)"   type="number" step="0.01" required defaultValue="" placeholder="180000.00" />
      <FormField name="expensas"     label="Expensas mensuales ($)" type="number" step="0.01" defaultValue="0" />

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">Cadencia de aumentos</span>
        <select name="cadence" defaultValue="trimestral" className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors">
          {CADENCE_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">Índice de actualización</span>
        <select name="indexer" defaultValue="IPC_GENERAL" className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors">
          {INDEXER_OPTIONS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
        </select>
      </label>

      <FormField name="start_date" label="Fecha de inicio" type="date" required defaultValue={todayIso} />
      <FormField name="end_date"   label="Fecha de fin"    type="date" required defaultValue={endIso} />

      <FormField name="payment_day"    label="Día de pago (1–31)"  type="number" defaultValue="5" />

      <label className="flex flex-col gap-1.5">
        <span className="label-cap">Moneda</span>
        <select name="currency" defaultValue="ARS" className="h-10 px-3 rounded border border-line bg-cream text-[13px] text-ink outline-none focus:border-ink focus:bg-paper transition-colors">
          <option value="ARS">Pesos (ARS)</option>
          <option value="USD">Dólares (USD)</option>
        </select>
      </label>

      <FormField name="contract_number" label="Número de contrato" defaultValue="" placeholder="opcional" />
      <FormField name="lfa_code"        label="LFA (admin a cargo)" defaultValue="" placeholder="L / F / A" />

      <FormError message={error} />

      <FormFooter>
        <SavedIndicator savedAt={null} idleHint={DELAYED_HINT_CREATE} />
        <DelayedActionButton
          variant="primary"
          label="Crear contrato"
          pendingLabel="Creando…"
          onConfirm={() => formRef.current?.requestSubmit()}
          pending={pending}
        />
      </FormFooter>
    </form>
  )
}
