'use client'

// ============================================================================
// AplicarAumentoControl — applies an IPC aumento to a contract from the
// detail page. Enter a % and it previews the new amounts before applying.
//
// For a two-part contract (facturado + N/F) the SAME factor scales each part
// independently (per Alejandro), so the preview shows both. The server action
// (applyContractAumento) does the real math + records the adjustment.
// ============================================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp } from 'lucide-react'
import { fmtMoney as fmt } from '@/lib/format'
import { applyContractAumento } from '@/lib/contract/inline-field-actions'

interface Props {
  contractId:        string
  currentRent:       number
  rentFacturadoNeto: number | null
  rentNoFacturado:   number
  rentIvaRate:       number
}

export function AplicarAumentoControl({
  contractId, currentRent, rentFacturadoNeto, rentNoFacturado, rentIvaRate,
}: Props) {
  const [open, setOpen]     = useState(false)
  const [pctStr, setPctStr] = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const pct      = Number(pctStr)
  const validPct = pctStr.trim() !== '' && isFinite(pct) && pct > -100
  const factor   = 1 + pct / 100
  const twoPart  = rentFacturadoNeto != null
  const newNeto  = twoPart ? (rentFacturadoNeto as number) * factor : 0
  const newNf    = twoPart ? rentNoFacturado * factor : 0
  const newTotal = twoPart ? newNeto * (1 + rentIvaRate / 100) + newNf : currentRent * factor

  function apply() {
    setError(null)
    if (!validPct) { setError('Ingresá un porcentaje válido.'); return }
    startTransition(async () => {
      const res = await applyContractAumento(contractId, pct)
      if (!res.ok) { setError(res.error ?? 'Error al aplicar el aumento.'); return }
      setOpen(false)
      setPctStr('')
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[12px] text-ink hover:border-info/40 transition-colors"
      >
        <TrendingUp size={14} /> Aplicar aumento
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-line bg-paper p-3 space-y-2 w-full max-w-[360px]">
      <div className="flex items-center gap-2">
        <label className="text-[12px] text-slate">Aumento</label>
        <input
          type="number" step="any" autoFocus value={pctStr}
          onChange={e => setPctStr(e.target.value)}
          placeholder="0"
          className="h-8 w-24 px-2 text-[12px] border border-line rounded bg-paper outline-none focus:border-info text-right tabular-nums"
        />
        <span className="text-[12px] text-slate">%</span>
      </div>
      {validPct && (
        <div className="text-[11.5px] text-slate-dark space-y-0.5 tabular-nums">
          {twoPart && (
            <>
              <div className="flex justify-between gap-3"><span>Facturado neto</span><span>{fmt(rentFacturadoNeto as number)} → {fmt(newNeto)}</span></div>
              <div className="flex justify-between gap-3"><span>N/F</span><span>{fmt(rentNoFacturado)} → {fmt(newNf)}</span></div>
            </>
          )}
          <div className="flex justify-between gap-3 font-medium text-ink"><span>Total</span><span>{fmt(currentRent)} → {fmt(newTotal)}</span></div>
        </div>
      )}
      {error && <p className="text-[11px] text-danger">{error}</p>}
      <div className="flex items-center justify-end gap-1.5">
        <button type="button" onClick={() => { setOpen(false); setError(null) }} disabled={pending} className="px-2 py-1 text-[11px] text-slate-dark hover:text-ink">Cancelar</button>
        <button type="button" onClick={apply} disabled={pending || !validPct} className="px-2.5 py-1 text-[11px] bg-ink text-paper rounded font-medium hover:opacity-90 disabled:opacity-60">
          {pending ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
    </div>
  )
}
