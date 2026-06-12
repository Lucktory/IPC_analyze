'use client'

// ============================================================================
// LiquidacionActionsBar — the three status transition buttons + their
// delayed-confirm wrappers. State machine:
//
//   draft  →  sent   ("Marcar enviada")
//   sent   →  paid   ("Marcar pagada")
//   paid   →  sent   ("Volver a enviada") [in case payment was a mistake]
//   sent   →  draft  ("Volver a borrador") [in case envío was a mistake]
//
// Every transition uses the shared DelayedActionButton — money-affecting
// state changes get the same 10-second arm-cancel safety as Save/Delete
// everywhere else.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { transitionLiquidacionStatus } from '@/lib/liquidacion/actions'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'
import type { LiquidacionStatus } from '@/lib/liquidacion/queries'

interface Props {
  contractId: string
  landlordId: string
  period:     string
  status:     LiquidacionStatus
}

export function LiquidacionActionsBar({ contractId, landlordId, period, status }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  const router                     = useRouter()

  function transition(next: LiquidacionStatus) {
    setError(null)
    startTransition(async () => {
      const res = await transitionLiquidacionStatus(contractId, landlordId, period, next)
      if (!res.ok) {
        setError(res.error ?? 'Error al cambiar el estado')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {status === 'draft' && (
          <DelayedActionButton
            variant="primary"
            label="Marcar enviada"
            pendingLabel="Enviando…"
            onConfirm={() => transition('sent')}
            pending={pending}
          />
        )}
        {status === 'sent' && (
          <>
            <DelayedActionButton
              variant="primary"
              label="Volver a borrador"
              pendingLabel="Actualizando…"
              onConfirm={() => transition('draft')}
              pending={pending}
            />
            <DelayedActionButton
              variant="primary"
              label="Marcar pagada"
              pendingLabel="Confirmando…"
              onConfirm={() => transition('paid')}
              pending={pending}
            />
          </>
        )}
        {status === 'paid' && (
          <DelayedActionButton
            variant="primary"
            label="Volver a enviada"
            pendingLabel="Actualizando…"
            onConfirm={() => transition('sent')}
            pending={pending}
          />
        )}
      </div>
      {error && (
        <p className="text-[12px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-1.5 max-w-xs">
          {error}
        </p>
      )}
    </div>
  )
}
