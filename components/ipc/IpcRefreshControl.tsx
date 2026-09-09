'use client'

// ============================================================================
// IpcRefreshControl — lives in the top bar next to the theme toggle.
//
//  • Manual: click the button → fetch INDEC IPC → MODAL showing what was updated.
//  • Automatic: on open, from the 15th onward, if last month's IPC isn't loaded
//    yet, it auto-fetches ONCE per day (localStorage guard). Once it succeeds the
//    month is present so it won't re-fetch (no re-scrape on the 16th). If it fails
//    it retries the next day; a real error shows an alert modal with the cause.
//  • A small "act. DD/MM" note shows when it was last updated.
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, X, TriangleAlert, Check } from 'lucide-react'
import { refreshIpc, getIpcStatus, type IpcStatus, type IpcMonthRow } from '@/lib/ipc/actions'
import { fmtIndex } from '@/lib/format'

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const mLabel = (m: string) => { const [y, mm] = m.split('-'); return `${MONTHS_ES[+mm - 1]} ${y}` }
const dLabel = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')}%`

type Modal =
  | null
  | { kind: 'success'; count: number; latest: string | null; months: IpcMonthRow[] }
  | { kind: 'error'; message: string }

export function IpcRefreshControl() {
  const [status, setStatus] = useState<IpcStatus | null>(null)
  const [pending, setPending] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const autoRan = useRef(false)

  async function doRefresh(auto: boolean, prevLatest: string | null) {
    setPending(true)
    try {
      const res = await refreshIpc()
      if (!res.ok) { setModal({ kind: 'error', message: res.error ?? 'Error desconocido.' }); return }
      const st = await getIpcStatus()
      setStatus(st)
      const broughtNew = !!res.latest && (!prevLatest || res.latest > prevLatest)
      // Manual always shows the modal; auto only when it actually brought a new month.
      if (!auto || broughtNew) {
        setModal({ kind: 'success', count: res.count ?? 0, latest: res.latest ?? null, months: res.months ?? [] })
      }
    } catch (e) {
      setModal({ kind: 'error', message: e instanceof Error ? e.message : 'No se pudo conectar con el INDEC.' })
    } finally {
      setPending(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    getIpcStatus().then(st => {
      if (cancelled) return
      setStatus(st)
      if (st.needsRefresh && !autoRan.current) {
        try {
          const key = `ipc-auto-${st.todayKey}`
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, '1')     // one auto-attempt per ART day
            autoRan.current = true
            doRefresh(true, st.latestMonth)
          }
        } catch { /* localStorage disabled — skip auto */ }
      }
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lastUpdated = status?.lastFetchedAt ? dLabel(status.lastFetchedAt) : null

  return (
    <div className="flex items-center gap-1.5 self-center">
      <button
        type="button"
        onClick={() => doRefresh(false, status?.latestMonth ?? null)}
        disabled={pending}
        title={`Actualizar IPC (INDEC)${status?.latestMonth ? ` · último ${mLabel(status.latestMonth)}` : ''}`}
        className={`h-8 px-2.5 rounded-lg border inline-flex items-center gap-1.5 text-[12px] font-semibold transition-colors self-center disabled:opacity-60 ${
          status?.needsRefresh
            ? 'border-warn/60 text-warn bg-warn/15 hover:bg-warn/25'
            : 'border-line text-ink bg-cream-2 hover:border-info/60 hover:text-info'
        }`}
      >
        <RefreshCw className={`w-4 h-4 ${pending ? 'animate-spin' : ''}`} strokeWidth={2} />
        <span>IPC</span>
        {status?.needsRefresh && !pending && <span className="w-1.5 h-1.5 rounded-full bg-warn" aria-hidden />}
      </button>
      {lastUpdated && <span className="hidden xl:inline text-[10px] text-slate whitespace-nowrap">act. {lastUpdated}</span>}

      {modal && <IpcModal modal={modal} onClose={() => setModal(null)} />}
    </div>
  )
}

function IpcModal({ modal, onClose }: { modal: NonNullable<Modal>; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-ink/40" onClick={onClose}>
      <div className="w-full max-w-[420px] bg-paper border border-line rounded-2xl shadow-lg p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 text-white ${modal.kind === 'success' ? 'bg-success' : 'bg-danger'}`}>
              {modal.kind === 'success' ? <Check size={20} /> : <TriangleAlert size={20} />}
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-ink leading-tight">
                {modal.kind === 'success' ? 'IPC actualizado' : 'No se pudo actualizar el IPC'}
              </h2>
              {modal.kind === 'success'
                ? <p className="text-[12px] text-slate mt-0.5">{modal.count} meses · último {modal.latest ? mLabel(modal.latest) : '—'} · fuente INDEC</p>
                : <p className="text-[12px] text-slate mt-0.5">Se reintenta automáticamente mañana.</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate hover:text-ink -mt-1 -mr-1 p-1"><X size={18} /></button>
        </div>

        {modal.kind === 'success' ? (
          <div className="mt-4 border border-line rounded-lg overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-cream-2 text-slate">
                <tr>
                  <th className="text-left  px-3 py-1.5 font-medium">Mes</th>
                  <th className="text-right px-3 py-1.5 font-medium">Var. mensual</th>
                  <th className="text-right px-3 py-1.5 font-medium">Índice</th>
                </tr>
              </thead>
              <tbody>
                {modal.months.slice().reverse().map(r => (
                  <tr key={r.month} className="border-t border-line/60">
                    <td className="px-3 py-1.5 text-ink">{mLabel(r.month)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-dark">{fmtPct(r.variationPct)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-dark">{fmtIndex(r.indexValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 break-words">{modal.message}</p>
        )}

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-lg bg-ink text-paper text-[13px] font-medium hover:opacity-90">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
