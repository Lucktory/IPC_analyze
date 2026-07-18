'use client'

// ============================================================================
// CadenceControl — inline editor for a contract's cadence (how often the rent
// adjusts). The aumento window depends on it, so a wrong value computes the
// wrong increase (e.g. the Bustos import defaulted to trimestral but it's
// bimestral). Change it here and the IPC aumento recalculates.
// ============================================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBusyTransition } from '@/components/shell/NavProgress'
import { updateContractCadence } from '@/lib/contract/inline-field-actions'

const OPTIONS: [string, string][] = [
  ['mensual', 'Mensual'], ['bimestral', 'Bimestral'], ['trimestral', 'Trimestral'],
  ['cuatrimestral', 'Cuatrimestral'], ['semestral', 'Semestral'], ['anual', 'Anual'],
]

export function CadenceControl({ contractId, cadence }: { contractId: string; cadence: string }) {
  const [value, setValue] = useState(cadence)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useBusyTransition()
  const router = useRouter()

  function onChange(next: string) {
    const prev = value
    setValue(next)
    setError(null)
    startTransition(async () => {
      const res = await updateContractCadence(contractId, next)
      if (!res.ok) { setValue(prev); setError(res.error ?? 'Error al cambiar la cadencia.') }
      else router.refresh()
    })
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        value={value}
        disabled={pending}
        onChange={e => onChange(e.target.value)}
        aria-label="Cadencia del contrato"
        className="appearance-none bg-cream-2 border border-line rounded-md pl-2.5 pr-6 py-1 text-[12px] font-medium text-ink cursor-pointer hover:border-info/50 focus:outline-none focus:ring-2 focus:ring-info/40 transition-colors disabled:opacity-60"
      >
        {OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {error && <span className="text-[10px] text-danger" title={error}>!</span>}
    </span>
  )
}
