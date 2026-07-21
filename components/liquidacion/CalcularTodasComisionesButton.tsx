'use client'

// ============================================================================
// CalcularTodasComisionesButton — one click computes every pending commission
// of the period (contracts with a rent cobro but no commission yet), each at
// its own % and default bank. Delegates to generateAllCommissionsForPeriod,
// which reuses resyncCommissionForPeriod → generateCommissionForPeriod, so the
// result is identical to pressing "Calcular" on each row — just in one go.
// ============================================================================

import { useState } from 'react'
import { useBusyTransition } from '@/components/shell/NavProgress'
import { useRouter } from 'next/navigation'
import { generateAllCommissionsForPeriod } from '@/lib/transaction/actions'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'

export function CalcularTodasComisionesButton({ period }: { period: string }) {
  const [pending, startTransition] = useBusyTransition()
  const [msg, setMsg]     = useState<string | null>(null)
  const [isErr, setIsErr] = useState(false)
  const router = useRouter()

  function run() {
    setMsg(null); setIsErr(false)
    startTransition(async () => {
      const res = await generateAllCommissionsForPeriod(period)
      if (!res.ok) { setIsErr(true); setMsg(res.error ?? 'No se pudieron calcular las comisiones.'); return }
      setMsg(
        res.generated > 0
          ? `${res.generated} comisión${res.generated === 1 ? '' : 'es'} calculada${res.generated === 1 ? '' : 's'}.`
          : 'Todas las comisiones ya estaban calculadas.',
      )
      router.refresh()
    })
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <DelayedActionButton
        variant="primary"
        size="sm"
        label="Calcular todas las comisiones"
        pendingLabel="Calculando…"
        onConfirm={run}
        pending={pending}
      />
      {msg && <p className={`text-[11px] ${isErr ? 'text-danger' : 'text-slate'}`}>{msg}</p>}
    </div>
  )
}
