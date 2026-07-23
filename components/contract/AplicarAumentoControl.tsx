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
import { applyContractAumento, applyContractAumentoAmount, applyIpcAumento } from '@/lib/contract/inline-field-actions'
import { scaleRentByFactor, type SuggestedAumento } from '@/lib/contract/aumento'

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
  const [mode, setMode]       = useState<'pct' | 'amount'>('pct')
  const [pctStr, setPctStr]   = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [pending, startTransition] = useBusyTransition()
  const router = useRouter()

  const pct      = Number(pctStr)
  const validPct = pctStr.trim() !== '' && isFinite(pct) && pct > -100
  const amount   = Number(amountStr)
  const validAmount = amountStr.trim() !== '' && isFinite(amount) && amount > 0
  // Preview reuses the SAME scaling primitive as the server (no drift): % scales
  // by factor; monto is the typed total directly.
  const pctNewTotal    = scaleRentByFactor(currentRent, rentFacturadoNeto, rentNoFacturado, rentIvaRate, 1 + pct / 100).newRent
  const manualValid    = mode === 'pct' ? validPct : validAmount
  const manualNewTotal = mode === 'pct' ? pctNewTotal : amount

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
    if (!manualValid) { setError(mode === 'pct' ? 'Ingresá un porcentaje válido.' : 'Ingresá un monto válido.'); return }
    startTransition(async () => {
      const res = mode === 'pct'
        ? await applyContractAumento(contractId, pct)
        : await applyContractAumentoAmount(contractId, amount)
      if (!res.ok) { setError(res.error ?? 'Error al aplicar el aumento.'); return }
      setOpen(false); setPctStr(''); setAmountStr(''); router.refresh()
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

      {/* ── Manual override: % o monto nuevo directo ── */}
      {!showManual ? (
        <button type="button" onClick={() => setManual(true)} className="text-[11px] text-slate hover:text-ink">
          {suggested ? 'o cargar manual (% o monto)' : 'Cargar aumento manual'}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[12px] text-slate">Aumento manual</label>
            <div className="inline-flex rounded border border-line overflow-hidden text-[11px]">
              <button type="button" onClick={() => setMode('pct')}
                className={mode === 'pct' ? 'px-2 py-1 bg-ink text-paper' : 'px-2 py-1 text-slate hover:text-ink'}>%</button>
              <button type="button" onClick={() => setMode('amount')}
                className={mode === 'amount' ? 'px-2 py-1 bg-ink text-paper' : 'px-2 py-1 text-slate hover:text-ink'}>$ monto</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'pct' ? (
              <>
                <input type="number" step="any" autoFocus value={pctStr} onChange={e => setPctStr(e.target.value)} placeholder="0"
                  className="h-8 w-28 px-2 text-[12px] border border-line rounded bg-paper outline-none focus:border-info text-right tabular-nums" />
                <span className="text-[12px] text-slate">%</span>
              </>
            ) : (
              <>
                <span className="text-[12px] text-slate">$</span>
                <input type="number" step="any" autoFocus value={amountStr} onChange={e => setAmountStr(e.target.value)} placeholder="Monto nuevo"
                  className="h-8 w-36 px-2 text-[12px] border border-line rounded bg-paper outline-none focus:border-info text-right tabular-nums" />
              </>
            )}
          </div>
          {manualValid && (
            <div className="text-[11.5px] text-slate-dark tabular-nums">
              <span className="flex justify-between gap-3 font-medium text-ink"><span>Total</span><span>{fmt(currentRent)} → {fmt(manualNewTotal)}</span></span>
            </div>
          )}
          <button type="button" onClick={applyManual} disabled={pending || !manualValid}
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
