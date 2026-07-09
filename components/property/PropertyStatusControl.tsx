'use client'

// ============================================================================
// PropertyStatusControl — dar de baja / reactivar a property from its detail
// page. Alejandro: "A veces puedo perder una propiedad — porque el dueño se la
// quiere llevar, o porque yo no la quiero tener mas." Dar de baja drops the
// property from the active portfolio (is_active=false); fully reversible via
// reactivar. A two-step inline confirm guards the baja.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, RotateCcw } from 'lucide-react'
import {
  deactivateProperty, reactivateProperty, type UpdatePropertyResult,
} from '@/lib/property/actions'

interface Props {
  propertyId: string
  isActive:   boolean
}

export function PropertyStatusControl({ propertyId, isActive }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function run(action: () => Promise<UpdatePropertyResult>) {
    setError(null)
    startTransition(async () => {
      const res = await action()
      if (!res.ok) { setError(res.error ?? 'No se pudo cambiar el estado de la propiedad.'); return }
      setConfirming(false)
      router.refresh()
    })
  }

  // Inactive → reactivar (non-destructive, single click).
  if (!isActive) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button" onClick={() => run(() => reactivateProperty(propertyId))} disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[12px] text-ink hover:border-success/50 hover:text-success transition-colors disabled:opacity-60"
        >
          <RotateCcw size={14} /> {pending ? 'Reactivando…' : 'Reactivar propiedad'}
        </button>
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
    )
  }

  // Active → dar de baja, behind a two-step confirm.
  if (!confirming) {
    return (
      <button
        type="button" onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[12px] text-slate-dark hover:border-danger/50 hover:text-danger transition-colors"
      >
        <Ban size={14} /> Dar de baja
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-danger/40 bg-danger/5 p-3 space-y-2 w-full max-w-[340px]">
      <p className="text-[12px] text-ink">
        ¿Dar de baja esta propiedad? Dejará de contarse en tu cartera activa. Podés reactivarla después.
      </p>
      {error && <p className="text-[11px] text-danger">{error}</p>}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button" onClick={() => { setConfirming(false); setError(null) }} disabled={pending}
          className="px-2 py-1 text-[11px] text-slate-dark hover:text-ink disabled:opacity-60"
        >Cancelar</button>
        <button
          type="button" onClick={() => run(() => deactivateProperty(propertyId))} disabled={pending}
          className="px-2.5 py-1 text-[11px] bg-danger text-white rounded font-medium hover:opacity-90 disabled:opacity-60"
        >{pending ? 'Dando de baja…' : 'Sí, dar de baja'}</button>
      </div>
    </div>
  )
}
