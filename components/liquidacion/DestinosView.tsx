// ============================================================================
// DestinosView — compact per-account commission split, embedded as a tab
// inside /liquidacion. Three destinations stay SEPARATE per Alejandro's
// confirmed spec (#3). For deep reconciliation against the bank statement
// use the dedicated /conciliacion page, which has print + alias + CBU.
// ============================================================================

import Link from 'next/link'
import type { ReconciliationBucket } from '@/lib/reconciliation/queries'
import { fmtMoney } from '@/lib/format'
import { periodLabel } from '@/lib/period'

interface Props {
  buckets: ReconciliationBucket[]
  period:  string
}

const DATE = (s: string | null) => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export function DestinosView({ buckets, period }: Props) {
  const grandTotal = buckets.reduce((s, b) => s + b.total, 0)
  const grandCount = buckets.reduce((s, b) => s + b.count, 0)

  if (buckets.length === 0) {
    return (
      <section className="bg-paper border border-line rounded shadow-card p-10 text-center">
        <p className="text-[14px] text-slate">
          No hay comisiones registradas para {periodLabel(period)}.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="bg-paper border border-line rounded shadow-card p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-[15px] font-medium text-ink">Por cuenta destino</h2>
          <p className="text-[12px] text-slate mt-0.5">
            {periodLabel(period)} · {grandCount} comisiones · total {fmtMoney(grandTotal)}
          </p>
        </div>
        <Link
          href={`/conciliacion?period=${period}`}
          className="text-[12px] text-info hover:underline"
        >
          Abrir conciliación bancaria completa →
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {buckets.map(b => <BucketCard key={b.code} b={b} />)}
      </div>

      {/* Summary footer — TOTAL ADMI = sum of all destinations */}
      <div className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Resumen</h2>
          <p className="text-[12px] text-slate mt-0.5">
            Suma de las cuentas — debe coincidir con la columna ADMI de la grilla.
          </p>
        </div>
        <table className="w-full text-[13px]">
          <tbody>
            {buckets.map((b, i) => (
              <tr key={b.code} className={i % 2 === 0 ? 'bg-cream/40' : ''}>
                <td className="px-5 py-2.5 text-slate-dark">{b.label}</td>
                <td className="px-5 py-2.5 text-right tabular-nums text-slate-dark">{b.count} mov.</td>
                <td className="px-5 py-2.5 text-right tabular-nums font-medium text-ink">{fmtMoney(b.total)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-ink">
              <td className="px-5 py-2.5 font-medium text-ink">TOTAL ADMI</td>
              <td className="px-5 py-2.5 text-right tabular-nums font-medium text-ink">{grandCount} mov.</td>
              <td className="px-5 py-2.5 text-right tabular-nums font-display font-medium text-ink">{fmtMoney(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function BucketCard({ b }: { b: ReconciliationBucket }) {
  return (
    <div className="bg-paper border border-line rounded shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-line">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-[14px] font-medium text-ink">{b.label}</h3>
            <p className="text-[11px] text-slate mt-0.5">{b.bank}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-[17px] font-medium tabular-nums text-ink">{fmtMoney(b.total)}</p>
            <p className="text-[10.5px] text-slate">{b.count} mov.</p>
          </div>
        </div>
        {(b.alias || b.note) && (
          <div className="flex items-center gap-2 flex-wrap mt-2">
            {b.alias && (
              <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-cream-2 border border-line text-[10.5px] tabular-nums">
                <span className="label-cap text-slate text-[9px]">alias</span>
                <span className="text-ink font-medium">{b.alias}</span>
              </span>
            )}
            {b.note && <span className="text-[10.5px] text-slate italic">{b.note}</span>}
          </div>
        )}
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-cream-2/60 text-[10px] uppercase tracking-wider text-slate-dark font-medium sticky top-0">
            <tr className="border-b border-line">
              <th className="text-left  px-3 py-1.5">Fecha</th>
              <th className="text-left  px-3 py-1.5">Inquilino</th>
              <th className="text-right px-3 py-1.5">Comisión</th>
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i} className={`${i % 2 === 0 ? 'bg-cream/30' : ''} border-b border-line/30`}>
                <td className="px-3 py-1.5 text-slate-dark tabular-nums whitespace-nowrap">{DATE(r.bankDate)}</td>
                <td className="px-3 py-1.5 text-ink truncate max-w-[160px]">
                  {r.tenant ?? <span className="text-slate/50">—</span>}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{fmtMoney(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
