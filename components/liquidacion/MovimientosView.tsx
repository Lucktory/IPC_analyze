// ============================================================================
// MovimientosView — a compact per-period transaction log embedded as a tab
// inside /liquidacion. Not a substitute for the dedicated /movimientos page
// (which has filters + pagination); this one gives the encargada a quick
// glance at every movement that hit this period without leaving the
// liquidación context.
// ============================================================================

import Link from 'next/link'
import type { TransactionRow } from '@/lib/entities/queries'
import { fmtMoney } from '@/lib/format'
import { periodLabel } from '@/lib/period'

interface Props {
  txns:   TransactionRow[]
  period: string
}

const DATE = (s: string | null) => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export function MovimientosView({ txns, period }: Props) {
  const ingresos = txns.filter(t => t.direction === 'IN').reduce((s, t) => s + t.amount, 0)
  const egresos  = txns.filter(t => t.direction === 'OUT').reduce((s, t) => s + t.amount, 0)
  const neto     = ingresos - egresos

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniKPI label="Ingresos" value={fmtMoney(ingresos)} tone="success" />
        <MiniKPI label="Egresos"  value={fmtMoney(egresos)}  tone="danger" />
        <MiniKPI label="Neto"     value={fmtMoney(neto)}     tone="ink" />
      </div>

      <div className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">Movimientos del período</h2>
            <p className="text-[12px] text-slate mt-0.5">
              {periodLabel(period)} · {txns.length} {txns.length === 1 ? 'movimiento' : 'movimientos'}
            </p>
          </div>
          <Link
            href={`/movimientos?period=${period}`}
            className="text-[12px] text-info hover:underline"
          >
            Abrir vista completa con filtros →
          </Link>
        </div>

        {txns.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[14px] text-slate">No hay movimientos registrados en este período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] min-w-[820px] border-collapse">
              <thead className="bg-cream-2/60 text-[10px] uppercase tracking-wider text-slate-dark font-medium">
                <tr className="border-b border-line">
                  <th className="text-left  px-3 py-2 border-r border-line/40">Fecha</th>
                  <th className="text-left  px-3 py-2 border-r border-line/40">Tipo</th>
                  <th className="text-left  px-3 py-2 border-r border-line/40">Inquilino</th>
                  <th className="text-right px-3 py-2 border-r border-line/40">Monto</th>
                  <th className="text-left  px-3 py-2">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t, idx) => {
                  const isIn = t.direction === 'IN'
                  const zebra = idx % 2 === 0 ? 'bg-cream/30' : 'bg-paper'
                  return (
                    <tr key={t.id} className={`${zebra} hover:bg-cream-2 transition-colors border-b border-line/30`}>
                      <td className="px-3 py-1.5 text-slate-dark tabular-nums border-r border-line/30 whitespace-nowrap">
                        {DATE(t.bankDate)}
                      </td>
                      <td className="px-3 py-1.5 border-r border-line/30">
                        <span className={`inline-flex items-center gap-1.5 text-[11.5px]`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${isIn ? 'bg-success' : 'bg-danger'}`} />
                          <Link href={`/movimientos/${t.id}`} className="text-ink hover:underline">
                            {t.typeLabel}
                          </Link>
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-slate-dark border-r border-line/30 truncate max-w-[180px]">
                        {t.tenantName ?? '—'}
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums font-medium border-r border-line/30 ${isIn ? 'text-success' : 'text-danger'}`}>
                        {isIn ? '+ ' : '− '}{fmtMoney(t.amount)}
                      </td>
                      <td className="px-3 py-1.5 text-slate text-[11.5px] truncate max-w-[300px]">
                        {t.description ?? ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

function MiniKPI({ label, value, tone }: { label: string; value: string; tone: 'success' | 'danger' | 'ink' }) {
  const accent =
    tone === 'success' ? 'border-l-success text-success' :
    tone === 'danger'  ? 'border-l-danger text-danger'   :
                         'border-l-ink text-ink'
  return (
    <div className={`bg-paper border border-line border-l-2 ${accent.split(' ')[0]} rounded shadow-card p-4`}>
      <p className="label-cap text-slate">{label}</p>
      <p className={`font-display text-[20px] mt-1 tabular-nums ${accent.split(' ')[1]}`}>{value}</p>
    </div>
  )
}
