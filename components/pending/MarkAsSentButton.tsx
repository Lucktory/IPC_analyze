'use client'

import { useTransition } from 'react'
import { markActionSent } from '@/lib/pending/actions'
import type { PendingCategory } from '@/lib/pending/queries'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'

interface MarkAsSentButtonProps {
  contractId: string
  category:   PendingCategory
}

/**
 * "Marcar enviado" button. Lives inside the /pendientes row cell so the
 * wrapping span stops click propagation — otherwise the surrounding
 * <ClickableRow> would also navigate to /contratos/[id].
 */
export function MarkAsSentButton({ contractId, category }: MarkAsSentButtonProps) {
  const [pending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      await markActionSent(contractId, category)
    })
  }

  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      <DelayedActionButton
        variant="primary"
        size="sm"
        label="Enviado"
        pendingLabel="Marcando…"
        onConfirm={handleConfirm}
        pending={pending}
        title="Marcar como enviado — desaparece de la lista por 7 días"
      />
    </span>
  )
}
