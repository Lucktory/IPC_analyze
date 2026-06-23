// ============================================================================
// RecurringChargesPanel — read-only breakdown of a contract's recargos.
//
// Used in two places:
//   • Inside the planilla's Recargos cell popover (click to expand)
//   • As an embedded section on /contratos/[id] below the editor
//
// Per Alejandro 2026-06-20: the Alquiler column stays pure; recargos go in
// a separate column. The cell shows the total and a status dot; clicking
// expands this panel which lists every line (ABL, THU, Camuzzi, ...) with
// a ✓ when its corresponding transaction was recorded this period or a ⚠
// when it's still pending.
// ============================================================================

import { fmtMoney } from '@/lib/format'
import { periodLabel } from '@/lib/period'
import type { RecurringChargesSummary } from '@/lib/contract/recurring-charges-bulk'

interface Props {
  summary: RecurringChargesSummary
  /** YYYY-MM-DD of the period being viewed (for the header label). */
  period:  string
  /** Optional href so the popover can offer "Editar en contrato →". */
  editHref?: string
}

export function RecurringChargesPanel({ summary, period, editHref }: Props) {
  const hasLines      = summary.lines.length > 0
  const recordedTotal = summary.lines
    .filter(l => l.recorded === true)
    .reduce((s, l) => s + l.amount, 0)

  return (
    <div className="text-[12.5px]">
      <p className="font-display text-[14px] font-medium text-ink mb-3">
        Recargos · {periodLabel(period)}
      </p>

      {!hasLines && (
        <p className="text-slate italic text-[12px]">
          Este contrato no tiene recargos mensuales cargados.
        </p>
      )}

      {hasLines && (
        <>
          <ul className="space-y-1">
            {summary.lines.map(l => (
              <li key={l.id} className="grid grid-cols-[16px_1fr_auto] gap-2 items-baseline">
                <span aria-hidden className="text-[13px] text-center">
                  {l.recorded === true && <span className="text-success">✓</span>}
                  {l.recorded === false && <span className="text-warn">⚠</span>}
                  {l.recorded === null && <span className="text-gray-300">·</span>}
                </span>
                <span className="text-slate-dark">
                  <strong className="text-ink font-medium">{l.label}</strong>
                  {l.recorded === true && l.recordedOn && (
                    <span className="text-[10.5px] text-slate ml-2">
                      cobrado el {l.recordedOn.slice(8, 10)}/{l.recordedOn.slice(5, 7)}
                    </span>
                  )}
                  {l.recorded === false && (
                    <span className="text-[10.5px] text-warn ml-2">falta registrar</span>
                  )}
                  {l.recorded === null && (
                    <span className="text-[10.5px] text-slate ml-2 italic">sin tipo asignado</span>
                  )}
                </span>
                <span className="tabular-nums text-ink">{fmtMoney(l.amount)}</span>
              </li>
            ))}
          </ul>

          <div className="border-t border-line/60 mt-3 pt-2 grid grid-cols-[1fr_auto] gap-x-3">
            <span className="text-slate-dark">Total esperado</span>
            <span className="tabular-nums text-ink font-medium">{fmtMoney(summary.totalExpected)}</span>
          </div>
          {summary.typedCount > 0 && (
            <div className="grid grid-cols-[1fr_auto] gap-x-3 text-[11.5px]">
              <span className="text-slate">Cobrado al día</span>
              <span className="tabular-nums text-slate-dark">{fmtMoney(recordedTotal)}</span>
            </div>
          )}
          {summary.typedCount > 0 && summary.recordedCount < summary.typedCount && (
            <div className="grid grid-cols-[1fr_auto] gap-x-3 text-[11.5px]">
              <span className="text-warn font-medium">Falta cobrar</span>
              <span className="tabular-nums text-warn font-medium">
                {fmtMoney(summary.totalExpected - recordedTotal)}
              </span>
            </div>
          )}

          {summary.typedCount === 0 && summary.lines.length > 0 && (
            <p className="text-[10px] text-slate italic mt-2 leading-snug">
              Ninguno de los recargos tiene tipo de transacción asignado, así
              que no podemos verificar automáticamente si ya entró el cobro.
              Cargá el tipo (RECUPERO_*_IN) en cada recargo para que la
              celda muestre el puntito verde / rojo.
            </p>
          )}
        </>
      )}

      {editHref && (
        <div className="mt-3 pt-2 border-t border-line/60">
          <a
            href={editHref}
            className="text-[11.5px] text-ink hover:underline inline-flex items-center gap-1"
          >
            Editar en contrato →
          </a>
        </div>
      )}
    </div>
  )
}
