import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'
import { StickyHeader } from '@/components/ui/StickyHeader'
import Link from 'next/link'
import { listTransactions, listTransactionPeriods, type TransactionRow } from '@/lib/entities/queries'

export const revalidate = 0

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

const PERIOD_LABEL = (s: string | null) => {
  if (!s) return '—'
  const [y, m] = s.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${months[+m - 1]} ${y}`
}

const DATE_LABEL = (s: string | null) => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

interface PageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function MovimientosPage({ searchParams }: PageProps) {
  const { period } = await searchParams
  const [periods, txns] = await Promise.all([
    listTransactionPeriods(),
    listTransactions(period),
  ])

  const inTotal  = txns.filter(t => t.direction === 'IN').reduce((s, t) => s + t.amount, 0)
  const outTotal = txns.filter(t => t.direction === 'OUT').reduce((s, t) => s + t.amount, 0)

  const kpis = [
    { label: 'Movimientos',  value: txns.length.toString(),                     delta: 'en el período',           tone: 'neutral'  as const },
    { label: 'Ingresos',     value: '$' + (inTotal / 1_000_000).toFixed(2) + ' M', delta: 'cobros del período',   tone: 'positive' as const },
    { label: 'Egresos',      value: '$' + (outTotal / 1_000_000).toFixed(2) + ' M', delta: 'comisión + gastos',  tone: 'negative' as const },
    { label: 'Neto',         value: '$' + ((inTotal - outTotal) / 1_000_000).toFixed(2) + ' M', delta: 'a transferir',  tone: 'neutral'   as const },
  ]

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <p className="text-[13px] text-slate-dark">
            <strong className="text-ink font-medium">Movimientos</strong> ·{' '}
            {period ? PERIOD_LABEL(period) : `todos los períodos (${txns.length})`}
          </p>
          <p className="label-cap text-slate">Datos en vivo</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
          ))}
        </div>
      </StickyHeader>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">Detalle</h2>
            <p className="text-[12px] text-slate mt-0.5">
              {period
                ? `Filtrado por ${PERIOD_LABEL(period)}`
                : 'Todos los movimientos registrados, ordenados por fecha bancaria descendente'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] text-slate">Período:</span>
            <PeriodPill label="Todos" href="/movimientos" active={!period} />
            {periods.map(p => (
              <PeriodPill key={p} label={PERIOD_LABEL(p)} href={`/movimientos?period=${p}`} active={period === p} />
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          {txns.length > 0 ? (
            <table className="w-full text-[13px] min-w-[920px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Fecha</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Período</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Tipo</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Inquilino</th>
                  <th className="text-right px-5 py-2.5 label-cap font-medium">Monto</th>
                  <th className="text-left  px-5 py-2.5 label-cap font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {txns.slice(0, 200).map((t, idx) => <TxRow key={t.id} t={t} odd={idx % 2 === 0} />)}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[14px] text-slate">No hay movimientos para este período</p>
            </div>
          )}
          {txns.length > 200 && (
            <p className="px-5 py-3 text-[12px] text-slate border-t border-line">
              Mostrando los primeros 200 de {txns.length}. Usá el filtro de período para acotar.
            </p>
          )}
        </div>
      </section>
    </>
  )
}

function TxRow({ t, odd }: { t: TransactionRow; odd: boolean }) {
  return (
    <tr className={`${odd ? 'bg-cream/40' : ''} hover:bg-cream-2 transition-colors`}>
      <td className="px-5 py-3 text-slate-dark tabular-nums">{DATE_LABEL(t.bankDate)}</td>
      <td className="px-5 py-3 text-slate-dark">{PERIOD_LABEL(t.period)}</td>
      <td className="px-5 py-3">
        <Badge tone={t.direction === 'IN' ? 'success' : 'neutral'}>{t.typeLabel}</Badge>
      </td>
      <td className="px-5 py-3 text-ink">{t.tenantName ?? <span className="text-slate/50">—</span>}</td>
      <td className={`px-5 py-3 text-right tabular-nums font-medium ${t.direction === 'IN' ? 'text-ink' : 'text-slate-dark'}`}>
        {t.direction === 'IN' ? '+ ' : '− '}{fmt(t.amount)}
      </td>
      <td className="px-5 py-3 text-slate text-[12px] truncate max-w-[280px]">
        {t.description ?? <span className="text-slate/50">—</span>}
      </td>
    </tr>
  )
}

function PeriodPill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        'inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors',
        active
          ? 'bg-ink text-paper border-ink'
          : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
      ].join(' ')}
    >
      {label}
    </Link>
  )
}
