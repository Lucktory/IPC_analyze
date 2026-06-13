import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { StickyKPIStrip, StickyKPIStripItem } from '@/components/ui/StickyKPIStrip'
import { listTransactionPeriods } from '@/lib/entities/queries'
import { getCurrentPeriod, periodLabel, periodShort } from '@/lib/period'
import { getLiquidacionGridForPeriod } from '@/lib/liquidacion/queries'
import { LiquidacionGrid } from '@/components/liquidacion/LiquidacionGrid'
import { fmtMoney as fmt } from '@/lib/format'

interface PageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function LiquidacionPage({ searchParams }: PageProps) {
  const { period: paramPeriod } = await searchParams
  const period = paramPeriod ?? getCurrentPeriod()

  const [periods, rows] = await Promise.all([
    listTransactionPeriods(),
    getLiquidacionGridForPeriod(period),
  ])

  // ── KPIs aggregated across the visible rows ──
  const cobrados      = rows.filter(r => !!r.fechaBanco).length
  const transferidos  = rows.filter(r => !!r.diaTransf).length
  const pendientes    = rows.length - cobrados
  const totalIngresos = rows.reduce((s, r) => s + r.ingresos, 0)
  const totalAdmi     = rows.reduce((s, r) => s + r.admi, 0)
  const totalNeto     = rows.reduce((s, r) => s + r.transferencia, 0)
  const conAumento    = rows.filter(r => r.hasUpcomingAdjustment).length

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between gap-3 flex-wrap sm:flex-nowrap mb-2">
          <p className="text-[13px] text-slate-dark min-w-0 truncate flex-1 sm:flex-initial">
            <strong className="text-ink font-medium">Liquidación</strong>
            {' · '}
            {periodLabel(period)}
            {' · '}
            {cobrados} de {rows.length} cobrados
          </p>
        </div>

        <StickyKPIStrip cols={4}>
          <StickyKPIStripItem>
            <KPICard
              label="Cobrados este mes"
              value={`${cobrados} / ${rows.length}`}
              delta={pendientes > 0 ? `${pendientes} sin cobrar` : 'todo cobrado'}
              deltaTone={pendientes > 0 ? 'negative' : 'positive'}
            />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard
              label="Total cobrado"
              value={fmt(totalIngresos)}
              delta={`${periodShort(period)} · ingresos`}
              deltaTone="neutral"
            />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard
              label="Comisión administración"
              value={fmt(totalAdmi)}
              delta={totalIngresos > 0 ? `${(totalAdmi / totalIngresos * 100).toFixed(1)}% efectivo` : '—'}
              deltaTone="positive"
            />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard
              label="Avisos de aumento"
              value={conAumento.toString()}
              delta={conAumento > 0 ? 'contratos con aumento ≤30d' : 'sin aumentos próximos'}
              deltaTone={conAumento > 0 ? 'positive' : 'neutral'}
            />
          </StickyKPIStripItem>
        </StickyKPIStrip>
      </StickyHeader>

      {/* Period selector */}
      <section className="mt-4 bg-paper border border-line rounded shadow-card p-3 sm:p-4">
        <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          <span className="label-cap text-slate mr-1 shrink-0">Período</span>
          {periods.map(p => (
            <Link
              key={p}
              href={`/liquidacion?period=${p}`}
              className={[
                'inline-flex items-center px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors shrink-0',
                p === period
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
              ].join(' ')}
            >
              {periodShort(p)}
            </Link>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-slate">
          <span className="inline-block w-2 h-2 rounded-full bg-warn mr-1.5 align-middle" />
          Celdas naranjas = contrato con aumento de alquiler en ≤30 días.
          {' · '}
          <span className="text-slate-dark">Texto gris</span> = pendiente.
          {' · '}
          <span className="text-ink font-medium">Texto oscuro</span> = cobrado/transferido.
        </p>
      </section>

      {/* The 19-column grid */}
      <div className="mt-6">
        <LiquidacionGrid rows={rows} period={period} />
      </div>
    </>
  )
}
