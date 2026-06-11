'use client'

import { useTransition } from 'react'
import { markActionSent } from '@/lib/pending/actions'
import type { PendingCategory } from '@/lib/pending/queries'

interface MarkAsSentButtonProps {
  contractId: string
  category:   PendingCategory
}

/**
 * Tiny "Marcar enviado" button. Lives inside the /pendientes row cell so
 * its onClick must stopPropagation — otherwise the surrounding
 * <ClickableRow> would also navigate to /contratos/[id].
 */
export function MarkAsSentButton({ contractId, category }: MarkAsSentButtonProps) {
  const [pending, startTransition] = useTransition()

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    e.preventDefault()
    startTransition(async () => {
      await markActionSent(contractId, category)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title="Marcar como enviado — desaparece de la lista por 7 días"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-line bg-cream-2 text-slate-dark hover:bg-cream hover:border-slate/30 hover:text-ink text-[11px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {pending ? 'Marcando…' : 'Enviado'}
    </button>
  )
}
