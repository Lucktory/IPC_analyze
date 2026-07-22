'use client'

// ============================================================================
// RecargoCobradoToggle — the "Cobrado" checkbox on each recargo line in the
// recargos panel. Tildar marks the recargo as collected for the month (creates
// the matching recupero transaction at the configured amount); destildar
// removes it. Optimistic; router.refresh re-derives the ✓/⚠ + the planilla dot.
// ============================================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBusyTransition } from '@/components/shell/NavProgress'
import { setRecurringChargeCollected } from '@/lib/liquidacion/ingresos-line-actions'

interface Props {
  contractId:       string
  period:           string
  recuperoTypeCode: string
  amount:           number
  collected:        boolean
}

export function RecargoCobradoToggle({ contractId, period, recuperoTypeCode, amount, collected }: Props) {
  const [optimistic, setOptimistic] = useState<boolean | undefined>(undefined)
  const [error, setError]           = useState<string | null>(null)
  const [pending, startTx]          = useBusyTransition()
  const router = useRouter()
  const on = optimistic ?? collected

  function toggle() {
    const next = !on
    setOptimistic(next)
    setError(null)
    startTx(async () => {
      const res = await setRecurringChargeCollected({ contractId, period, recuperoTypeCode, amount, collected: next })
      if (!res.ok) {
        setOptimistic(undefined)
        setError(res.error ?? 'Error al guardar')
      } else {
        router.refresh()
      }
    })
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="checkbox"
        checked={on}
        onChange={toggle}
        disabled={pending}
        aria-label={on ? 'Cobrado este mes' : 'Marcar como cobrado este mes'}
        title={on ? 'Cobrado este mes — click para desmarcar' : 'Marcar como cobrado este mes'}
        className="h-4 w-4 accent-success cursor-pointer disabled:opacity-50"
      />
      {error && <span className="text-[9px] text-danger" title={error}>!</span>}
    </span>
  )
}
