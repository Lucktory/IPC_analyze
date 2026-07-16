'use client'

// ============================================================================
// ContractStatusControl — rescindir / reactivar a contract from its detail
// page. Alejandro: "A veces puedo perder una propiedad — porque el dueño se la
// quiere llevar, o porque yo no la quiero tener mas." Rescindir drops the
// contract off the active planilla (status='rescinded'); it stays fully
// reversible via reactivar.
//
// The destructive "Rescindir" reuses the shared DelayedActionButton: click to
// arm a countdown, click again to cancel, and it only fires after the delay —
// the same safety buffer used for every money-touching mutation in the app. No
// bespoke confirm logic here.
// ============================================================================

import { useState } from 'react'
import { useBusyTransition } from '@/components/shell/NavProgress'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import { rescindContract, reactivateContract, type InlineResult } from '@/lib/contract/inline-field-actions'
import { DelayedActionButton } from '@/components/ui/DelayedActionButton'

interface Props {
  contractId: string
  status:     string
}

export function ContractStatusControl({ contractId, status }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useBusyTransition()
  const router = useRouter()

  function run(action: () => Promise<InlineResult>) {
    setError(null)
    startTransition(async () => {
      const res = await action()
      if (!res.ok) { setError(res.error ?? 'No se pudo cambiar el estado del contrato.'); return }
      router.refresh()
    })
  }

  // Rescinded → reactivar (non-destructive, single click — no delay needed).
  if (status === 'rescinded') {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button" onClick={() => run(() => reactivateContract(contractId))} disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[12px] text-ink hover:border-success/50 hover:text-success transition-colors disabled:opacity-60"
        >
          <RotateCcw size={14} /> {pending ? 'Reactivando…' : 'Reactivar contrato'}
        </button>
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
    )
  }

  // Only active contracts can be rescinded (draft/ended/suspended have no
  // meaningful "rescindir" flow here).
  if (status !== 'active') return null

  // Active → rescindir behind the shared 5s delayed-action button.
  return (
    <div className="flex flex-col items-end gap-1">
      <DelayedActionButton
        variant="danger"
        size="sm"
        delaySeconds={5}
        label="Rescindir contrato"
        pendingLabel="Rescindiendo…"
        pending={pending}
        onConfirm={() => run(() => rescindContract(contractId))}
        title="Rescindir el contrato — se arma una cuenta regresiva; tocá de nuevo para cancelar"
      />
      {error && <p className="text-[11px] text-danger max-w-[240px] text-right">{error}</p>}
    </div>
  )
}
