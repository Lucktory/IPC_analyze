import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { listTransactionPeriods } from '@/lib/entities/queries'
import {
  getReconciliationByDestination,
  type ReconciliationBucket,
} from '@/lib/reconciliation/queries'

export const revalidate = 0

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

const PERIOD_LABEL = (s: string) => {
  const [y, m] = s.split('-')
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${months[+m - 1]} ${y}`
}

const PERIOD_SHORT = (s: string) => {
  const [y, m] = s.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${months[+m - 1]} ${y}`
}

const DATE_LABEL = (s: string | null) => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

const DEFAULT_PERIOD = '2026-05-01'

interface PageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function ConciliacionPage({ searchParams }: PageProps) {
  const { period: paramPeriod } = await searchParams
  const period = paramPeriod ?? DEFAULT_PERIOD

  const [periods, buckets] = await Promise.all([
    listTransactionPeriods(),
    getReconciliationByDestination(period),
  ])

  const grandTotal  = buckets.reduce((s, b) => s + b.total, 0)
  const grandCount  = buckets.reduce((s, b) => s + b.count, 0)

  const kpis = [
    { label: 'Comisión total',  value: '$' + (grandTotal / 1_000_000).toFixed(2) + ' M', delta: PERIOD_LABEL(period), tone: 'positive' as const },
    { label: 'Cuentas activas', value: buckets.length.toString(),                       delta: 'con movimientos en el período', tone: 'neutral'  as const },
    { label: 'Movimientos',     value: grandCount.toString(),                            delta: 'comisiones registradas',      tone: 'neutral'  as const },
  ]

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <p className="text-[13px] text-slate-dark">
            <strong className="text-ink font-medium">Conciliación bancaria</strong> · {PERIOD_LABEL(period)}
          </p>
          <p className="label-cap text-slate">Vista para conciliar contra extracto</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {kpis.map(k => (
            <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
          ))}
        </div>
      </StickyHeader>

      {/* Period filter */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="label-cap">Período a conciliar</p>
            <p className="text-[12px] text-slate mt-1">
              Cambiá el mes para ver los movimientos correspondientes
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {periods.map(p => (
              <Link
                key={p}
                href={`/conciliacion?period=${p}`}
                className={[
                  'inline-flex items-center px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors',
                  p === period
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
                ].join(' ')}
              >
                {PERIOD_SHORT(p)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Per-account sections */}
      {buckets.length === 0 ? (
        <section className="mt-6 bg-paper border border-line rounded shadow-card p-10 text-center">
          <p className="text-[14px] text-slate">No hay comisiones registradas para {PERIOD_LABEL(period)}</p>
        </section>
      ) : (
        <div className="mt-6 space-y-6">
          {buckets.map(b => <BucketSection key={b.code} b={b} />)}
        </div>
      )}

      {buckets.length > 0 && (
        <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-display text-[15px] font-medium text-ink">Resumen general</h2>
            <p className="text-[12px] text-slate mt-0.5">
              Suma de todas las cuentas — debe coincidir con la columna ADMI del Excel
            </p>
          </div>
          <table className="w-full text-[13px]">
            <tbody>
              {buckets.map((b, i) => (
                <tr key={b.code} className={i % 2 === 0 ? 'bg-cream/40' : ''}>
                  <td className="px-5 py-3 text-slate-dark">{b.label}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-dark">{b.count} mov.</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium text-ink">{fmt(b.total)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-ink">
                <td className="px-5 py-3 font-medium text-ink">TOTAL ADMI</td>
                <td className="px-5 py-3 text-right tabular-nums font-medium text-ink">{grandCount} mov.</td>
                <td className="px-5 py-3 text-right tabular-nums font-display font-medium text-ink">{fmt(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}

function BucketSection({ b }: { b: ReconciliationBucket }) {
  return (
    <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-[15px] font-medium text-ink">{b.label}</h2>
          <p className="text-[12px] text-slate mt-0.5">{b.subtitle}</p>
        </div>
        <div className="text-right">
          <p className="label-cap text-slate mb-0.5">Total esperado</p>
          <p className="font-display text-[20px] font-medium tabular-nums text-ink">{fmt(b.total)}</p>
          <p className="text-[11px] text-slate mt-0.5">{b.count} movimientos · debe coincidir con extracto</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[760px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Fecha banco</th>
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Inquilino</th>
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Propietario</th>
              <th className="text-right px-5 py-2.5 label-cap font-medium">Comisión</th>
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-cream/40' : ''}>
                <td className="px-5 py-2.5 text-slate-dark tabular-nums">{DATE_LABEL(r.bankDate)}</td>
                <td className="px-5 py-2.5 text-ink">{r.tenant ?? <span className="text-slate/50">—</span>}</td>
                <td className="px-5 py-2.5 text-slate-dark">{r.landlord ?? <span className="text-slate/50">—</span>}</td>
                <td className="px-5 py-2.5 text-right tabular-nums text-ink">{fmt(r.amount)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-ink/20 bg-cream-2">
              <td className="px-5 py-2.5 font-medium text-ink" colSpan={3}>Subtotal {b.label}</td>
              <td className="px-5 py-2.5 text-right tabular-nums font-display font-medium text-ink">{fmt(b.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
