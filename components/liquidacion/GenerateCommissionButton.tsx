'use client'

// ============================================================================
// GenerateCommissionButton — one-click "calcular comisión" for a
// (contract, period). Calls generateCommissionForPeriod which sums all IN
// transactions (affects_liquidacion=true) and creates/updates the
// COMMISSION_OUT row at contract.commission_pct of that total.
//
// Uses the same 10s arm-cancel safety as every money-touching action.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateCommissionForPeriod } from '@/lib/transaction/actions'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'

interface Props {
  contractId: string
  period:     string
}

export function GenerateCommissionButton({ contractId, period }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const router                     = useRouter()

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      const res = await generateCommissionForPeriod(contractId, period)
      if (!res.ok) {
        setError(res.error ?? 'No se pudo generar la comisión')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <DelayedActionButton
        variant="primary"
        label="Calcular comisión"
        pendingLabel="Calculando…"
        onConfirm={handleGenerate}
        pending={pending}
      />
      {error && (
        <p className="text-[11px] text-danger max-w-sm">{error}</p>
      )}
    </div>
  )
}
