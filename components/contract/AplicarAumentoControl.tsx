'use client'

// ============================================================================
// AplicarAumentoControl — applies an aumento to a contract from the detail page.
//
// Two paths:
//   • IPC (automatic): when an aumento is due and the INDEC index is loaded, the
//     new value is shown TENTATIVELY ("en gris") with its full provenance
//     ("de dónde salió"). One click confirms → applyIpcAumento. Per Alejandro:
//     "que se aplique... pero en gris, y el valor nuevo aplicado automáticamente."
//   • Manual (%): a hand-entered override, kept for the odd case.
//
// For a two-part contract (facturado + N/F) the SAME factor scales each part.
// ============================================================================

import { useState } from 'react'
import { useBusyTransition } from '@/components/shell/NavProgress'
import { useRouter } from 'next/navigation'
import { TrendingUp, ChevronDown } from 'lucide-react'
import { fmtMoney as fmt } from '@/lib/format'
import { applyContractAumento, applyIpcAumento } from '@/lib/contract/inline-field-actions'
import type { SuggestedAumento } from '@/lib/contract/aumento'

interface Props {
  contractId:        string
  currentRent:       number
  rentFacturadoNeto: number | null
  rentNoFacturado:   number
  rentIvaRate:       number
  suggested?:        SuggestedAumento | null
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const mLabel = (m: string) => { const [y, mm] = m.split('-'); return `${MONTHS_ES[+mm - 1]} ${y}` }

export function AplicarAumentoControl({
  contractId, currentRent, rentFacturadoNeto, rentNoFacturado, rentIvaRate, suggested,
}: Props) {
  const [open, setOpen]       = useState(false)
  const [showManual, setManual] = useState(false)
  const [showCalc, setCalc]   = useState(false)
  const [pctStr, setPctStr]   = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [pending, startTransition] = useBusyTransition()
  const router = useRouter()

  const pct      = Number(pctStr)
  const validPct = pctStr.trim() !== '' && isFinite(pct) && pct > -100
  const factor   = 1 + pct / 100
  const twoPart  = rentFacturadoNeto != null
  const newTotal = twoPart ? (rentFacturadoNeto as number) * factor * (1 + rentIvaRate / 100) + rentNoFacturado * factor : currentRent * factor

  const canConfirmIpc = !!suggested && !suggested.ipcMissing && suggested.expectedNewRent != null

  function confirmIpc() {
    if (!suggested) return
    setError(null)
    startTransition(async () => {
      const res = await applyIpcAumento(contractId, suggested.effectivePeriod)
      if (!res.ok) { setError(res.error ?? 'Error al aplicar el aumento.'); return }
      setOpen(false); router.refresh()
    })
  }

  function applyManual() {
    setError(null)
    if (!validPct) { setError('Ingresá un porcentaje válido.'); return }
    startTransition(async () => {
      const res = await applyContractAumento(contractId, pct)
      if (!res.ok) { setError(res.error ?? 'Error al aplicar el aumento.'); return }
      setOpen(false); setPctStr(''); router.refresh()
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
    <div className="rounded-lg border border-line bg-paper p-3 space-y-3 w-full max-w-[400px]">
      {/* ── IPC suggested (tentative "en gris") ── */}
      {suggested && (
        <div className="rounded-md border border-dashed border-line bg-cream-2/50 p-2.5">
          <p className="text-[11px] text-slate">Aumento IPC · {mLabel(suggested.effectivePeriod.slice(0, 7))}</p>
          {canConfirmIpc ? (
            <>
              {/* tentative value greyed until confirmed */}
              <p className="text-[13px] text-slate-dark tabular-nums mt-0.5">
                {fmt(currentRent)} <span className="text-slate">→</span>{' '}
                <span className="text-ink font-semibold">{fmt(suggested.expectedNewRent as number)}</span>
                <span className="text-slate"> ({suggested.pct! >= 0 ? '+' : ''}{suggested.pct!.toFixed(2).replace('.', ',')}%)</span>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button type="button" onClick={confirmIpc} disabled={pending}
                  className="px-2.5 py-1 text-[11px] bg-ink text-paper rounded font-medium hover:opacity-90 disabled:opacity-60">
                  {pending ? 'Aplicando…' : 'Confirmar aumento'}
                </button>
                <button type="button" onClick={() => setCalc(v => !v)}
                  className="inline-flex items-center gap-1 text-[11px] text-slate hover:text-ink">
                  <ChevronDown size={12} className={showCalc ? 'rotate-180 transition-transform' : 'transition-transform'} /> ¿de dónde salió?
                </button>
              </div>
              {showCalc && (
                <div className="mt-2 text-[10.5px] text-slate space-y-0.5 tabular-nums border-t border-line/60 pt-1.5">
                  <div>IPC INDEC · {suggested.windowMonths.map(mLabel).join(' · ')}</div>
                  <div>índice {mLabel(suggested.windowMonths[0] ? suggestedStartMonth(suggested) : '')}: {fmtIdx(suggested.indexStart)} → {mLabel(suggested.windowMonths[suggested.windowMonths.length - 1] ?? '')}: {fmtIdx(suggested.indexEnd)}</div>
                  <div>factor {suggested.indexStart && suggested.indexEnd ? (suggested.indexEnd / suggested.indexStart).toFixed(6) : '—'}</div>
                </div>
              )}
            </>
          ) : (
            <p className="text-[12px] text-warn mt-0.5">
              Falta cargar el IPC de {suggested.missingMonths.map(mLabel).join(', ')}. Tocá «Actualizar IPC» y volvé.
            </p>
          )}
        </div>
      )}

      {/* ── Manual % override ── */}
      {!showManual ? (
        <button type="button" onClick={() => setManual(true)} className="text-[11px] text-slate hover:text-ink">
          {suggested ? 'o cargar un % manual' : 'Cargar un % de aumento'}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[12px] text-slate">Aumento manual</label>
            <input type="number" step="any" autoFocus value={pctStr} onChange={e => setPctStr(e.target.value)} placeholder="0"
              className="h-8 w-24 px-2 text-[12px] border border-line rounded bg-paper outline-none focus:border-info text-right tabular-nums" />
            <span className="text-[12px] text-slate">%</span>
          </div>
          {validPct && (
            <div className="text-[11.5px] text-slate-dark tabular-nums">
              <span className="flex justify-between gap-3 font-medium text-ink"><span>Total</span><span>{fmt(currentRent)} → {fmt(newTotal)}</span></span>
            </div>
          )}
          <button type="button" onClick={applyManual} disabled={pending || !validPct}
            className="px-2.5 py-1 text-[11px] bg-ink text-paper rounded font-medium hover:opacity-90 disabled:opacity-60">
            {pending ? 'Aplicando…' : 'Aplicar manual'}
          </button>
        </div>
      )}

      {error && <p className="text-[11px] text-danger">{error}</p>}
      <div className="flex justify-end">
        <button type="button" onClick={() => { setOpen(false); setError(null) }} disabled={pending} className="px-2 py-1 text-[11px] text-slate-dark hover:text-ink">Cerrar</button>
      </div>
    </div>
  )
}

function fmtIdx(n: number | null): string { return n == null ? '—' : n.toLocaleString('es-AR', { maximumFractionDigits: 2 }) }
function suggestedStartMonth(s: SuggestedAumento): string {
  // denominator month = month before the first window month
  const first = s.windowMonths[0]
  if (!first) return ''
  const [y, m] = first.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
