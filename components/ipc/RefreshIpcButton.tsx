'use client'

// ============================================================================
// RefreshIpcButton — pulls the INDEC IPC index from datos.gob.ar into
// cpi_values. The one-month desfase means the data we need is always already
// published, so this is a manual "traelo cuando quieras" button.
// ============================================================================

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useBusyTransition } from '@/components/shell/NavProgress'
import { refreshIpc } from '@/lib/ipc/actions'

export function RefreshIpcButton({ latest }: { latest?: string | null }) {
  const [pending, startTransition] = useBusyTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  function run() {
    setMsg(null)
    startTransition(async () => {
      const res = await refreshIpc()
      setIsError(!res.ok)
      setMsg(res.ok ? `IPC actualizado: ${res.count} meses (hasta ${res.latest}).` : (res.error ?? 'Error al traer el IPC.'))
    })
  }

  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[12px] text-ink hover:border-info/40 transition-colors disabled:opacity-60"
      >
        <RefreshCw size={14} className={pending ? 'animate-spin' : ''} /> {pending ? 'Actualizando…' : 'Actualizar IPC'}
      </button>
      {msg
        ? <span className={`text-[11px] ${isError ? 'text-danger' : 'text-slate'}`}>{msg}</span>
        : latest && <span className="text-[11px] text-slate">último cargado: {latest}</span>}
    </div>
  )
}
