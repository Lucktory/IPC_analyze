'use client'

// ============================================================================
// CalcularTodasComisionesButton — opens a modal that PREVIEWS every pending
// commission of the period (contracts with a rent cobro but no commission yet),
// then, only after you confirm, calculates them — each at its own % and default
// bank. Preview + calc use the same server functions (previewAll... and
// generateAll...), which both route through computeCommissionForPeriod, so the
// numbers shown are exactly what gets saved.
// ============================================================================

import { useState } from 'react'
import { Calculator } from 'lucide-react'
import { useBusyTransition } from '@/components/shell/NavProgress'
import { useRouter } from 'next/navigation'
import {
  previewAllCommissionsForPeriod,
  generateAllCommissionsForPeriod,
  type CommissionPreviewRow,
} from '@/lib/transaction/actions'
import { fmtMoney } from '@/lib/format'

export function CalcularTodasComisionesButton({ period }: { period: string }) {
  const [open, setOpen]            = useState(false)
  const [pending, startTransition] = useBusyTransition()
  const [rows, setRows]            = useState<CommissionPreviewRow[] | null>(null)
  const [error, setError]          = useState<string | null>(null)
  const [done, setDone]            = useState<string | null>(null)
  const router = useRouter()

  function openModal() {
    setError(null); setDone(null); setRows(null); setOpen(true)
    startTransition(async () => {
      const res = await previewAllCommissionsForPeriod(period)
      if (!res.ok) { setError(res.error ?? 'No se pudo generar la vista previa.'); return }
      setRows(res.rows)
    })
  }

  function close() { if (!pending) { setOpen(false); setDone(null); setRows(null) } }

  function confirm() {
    setError(null)
    startTransition(async () => {
      const res = await generateAllCommissionsForPeriod(period)
      if (!res.ok) { setError(res.error ?? 'No se pudieron calcular las comisiones.'); return }
      setRows(null)
      setDone(`${res.generated} comisión${res.generated === 1 ? '' : 'es'} calculada${res.generated === 1 ? '' : 's'}.`)
      router.refresh()
    })
  }

  const total = (rows ?? []).reduce((s, r) => s + r.amount, 0)

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="Ver, calcular y actualizar las comisiones del período"
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-success text-white text-[13px] font-medium hover:brightness-110 transition-all shrink-0 shadow-sm"
      >
        <Calculator size={15} /> Calcular todas
      </button>

      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1100] flex items-center justify-center px-4">
          <button type="button" aria-label="Cerrar" onClick={close} className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" />
          <div className="relative bg-paper border border-line rounded shadow-xl w-full max-w-[660px] max-h-[85vh] overflow-y-auto">
            <div className="px-5 py-3 border-b border-line sticky top-0 bg-paper">
              <h2 className="font-display text-[15px] font-medium text-ink">Calcular todas las comisiones</h2>
              <p className="text-[11.5px] text-slate mt-0.5">Comisiones sin calcular o desactualizadas (por un cambio en el cobrado). Revisá y confirmá.</p>
            </div>

            <div className="px-5 py-4 space-y-3">
              {pending && !rows && !done && <p className="text-[12px] text-slate italic">Preparando vista previa…</p>}
              {error && <div className="text-[11.5px] text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">{error}</div>}
              {done  && <div className="text-[12px] text-success bg-success/10 border border-success/30 rounded px-3 py-2">{done}</div>}

              {rows && rows.length === 0 && !done && (
                <p className="text-[13px] text-slate py-4 text-center">Todas las comisiones están al día.</p>
              )}

              {rows && rows.length > 0 && (
                <div className="border border-line rounded overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead className="bg-cream-2 text-slate-dark">
                      <tr>
                        <th className="text-left  px-2.5 py-1.5 font-medium">Contrato</th>
                        <th className="text-right px-2.5 py-1.5 font-medium">Cobrado</th>
                        <th className="text-right px-2.5 py-1.5 font-medium">%</th>
                        <th className="text-right px-2.5 py-1.5 font-medium">Comisión</th>
                        <th className="text-left  px-2.5 py-1.5 font-medium">Banco</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.contractId} className="border-t border-line/60">
                          <td className="px-2.5 py-1.5 text-ink truncate max-w-[220px]">{r.label}</td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-dark">{fmtMoney(r.ingresos)}</td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-dark">{r.pct}%</td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums text-ink font-medium whitespace-nowrap">
                            {r.current != null && Math.abs(r.current - r.amount) >= 0.5 && (
                              <span className="text-slate font-normal line-through mr-1.5">{fmtMoney(r.current)}</span>
                            )}
                            {fmtMoney(r.amount)}
                          </td>
                          <td className="px-2.5 py-1.5 text-slate-dark">{r.bank}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-line bg-cream-2">
                        <td className="px-2.5 py-1.5 text-ink font-medium" colSpan={3}>Total ({rows.length})</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums text-ink font-semibold">{fmtMoney(total)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-line bg-cream-2 sticky bottom-0 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="px-3 py-1.5 rounded border border-line text-[12px] text-slate-dark hover:bg-cream-2 disabled:opacity-60 transition-colors"
              >
                {done ? 'Cerrar' : 'Cancelar'}
              </button>
              {rows && rows.length > 0 && !done && (
                <button
                  type="button"
                  onClick={confirm}
                  disabled={pending}
                  className="px-3 py-1.5 rounded bg-ink text-paper text-[12px] font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  {pending ? 'Calculando…' : `Confirmar y calcular (${rows.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
