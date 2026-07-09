'use client'

// ============================================================================
// ContractStatusControl — rescindir / reactivar a contract from its detail
// page. Alejandro: "A veces puedo perder una propiedad — porque el dueño se la
// quiere llevar, o porque yo no la quiero tener mas." Rescindir drops the
// contract off the active planilla (status='rescinded'); it stays fully
// reversible via reactivar. A two-step inline confirm guards the flip so it
// can't be triggered by a stray click.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, RotateCcw } from 'lucide-react'
import { rescindContract, reactivateContract, type InlineResult } from '@/lib/contract/inline-field-actions'

interface Props {
  contractId: string
  status:     string
}

export function ContractStatusControl({ contractId, status }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function run(action: () => Promise<InlineResult>) {
    setError(null)
    startTransition(async () => {
      const res = await action()
      if (!res.ok) { setError(res.error ?? 'No se pudo cambiar el estado del contrato.'); return }
      setConfirming(false)
      router.refresh()
    })
  }

  // Rescinded → reactivar (non-destructive, single click).
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

  // Active → rescindir, behind a two-step confirm.
  if (!confirming) {
    return (
      <button
        type="button" onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[12px] text-slate-dark hover:border-danger/50 hover:text-danger transition-colors"
      >
        <Ban size={14} /> Rescindir contrato
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-danger/40 bg-danger/5 p-3 space-y-2 w-full max-w-[340px]">
      <p className="text-[12px] text-ink">
        ¿Rescindir este contrato? Dejará de aparecer en la planilla activa. Podés reactivarlo después.
      </p>
      {error && <p className="text-[11px] text-danger">{error}</p>}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button" onClick={() => { setConfirming(false); setError(null) }} disabled={pending}
          className="px-2 py-1 text-[11px] text-slate-dark hover:text-ink disabled:opacity-60"
        >Cancelar</button>
        <button
          type="button" onClick={() => run(() => rescindContract(contractId))} disabled={pending}
          className="px-2.5 py-1 text-[11px] bg-danger text-white rounded font-medium hover:opacity-90 disabled:opacity-60"
        >{pending ? 'Rescindiendo…' : 'Sí, rescindir'}</button>
      </div>
    </div>
  )
}
