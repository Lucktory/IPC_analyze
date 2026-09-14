'use client'

// ============================================================================
// CommissionOnDepositEditor — decide si la administracion alcanza al deposito
// en garantia de ESTE contrato.
//
// Alejandro, 2026-09-14: "Se lo mandamos al propietario, previa deduccion de la
// administracion. Hay algun caso que nos pelea para que no le cobremos."
//
// Por eso el default es "Sí": lo normal es cobrarla, y apagarlo es la concesion
// que se le hace a un dueño puntual.
//
// Apagarlo NO cambia lo que recibe el propietario en total: el deposito se le
// transfiere igual. Lo unico que cambia es la base sobre la que se calcula la
// comision, o sea cuanto se queda la inmobiliaria.
//
// Es por contrato, igual que el % y el IVA. Un dueño con varios contratos
// necesita la marca en cada uno.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateContractCommissionOnDeposit } from '@/lib/contract/inline-field-actions'

interface Props {
  contractId: string
  value:      boolean
  /** Periodo visible — recalcula su comision al cambiar la marca. */
  period:     string
}

export function CommissionOnDepositEditor({ contractId, value, period }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Optimista: el valor se ve cambiado al instante y vuelve atras si falla.
  const [shown, setShown] = useState(value)

  const set = (next: boolean) => {
    if (next === shown || pending) return
    const prev = shown
    setShown(next)
    setError(null)
    startTransition(async () => {
      const res = await updateContractCommissionOnDeposit(contractId, next, period)
      if (!res.ok) { setShown(prev); setError(res.error); return }
      router.refresh()
    })
  }

  const opt = (v: boolean, label: string) => (
    <button
      type="button"
      disabled={pending}
      onClick={() => set(v)}
      className={`px-2 py-0.5 rounded text-[11.5px] transition-colors disabled:opacity-50 ${
        shown === v
          ? 'bg-ink text-paper font-medium'
          : 'text-slate hover:text-ink hover:bg-cream-2'
      }`}
    >
      {label}
    </button>
  )

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span
        className="inline-flex items-center gap-0.5 border border-line rounded p-0.5"
        title="Si la administración se cobra también sobre el depósito en garantía. El depósito se le transfiere al propietario en los dos casos."
      >
        {opt(true, 'Sí')}
        {opt(false, 'No')}
      </span>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </span>
  )
}
