import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { StickyKPIStrip, StickyKPIStripItem } from '@/components/ui/StickyKPIStrip'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { listTransactionPeriods } from '@/lib/entities/queries'
import { getCurrentPeriod, periodLabel, periodShort } from '@/lib/period'
import { getLiquidacionesForPeriod, type LiquidacionStatus } from '@/lib/liquidacion/queries'
import { fmtMoney as fmt } from '@/lib/format'

// Visual mapping confirmed by Alejandro: gray=draft, green=sent, blue=paid.
const STATUS_THEME: Record<LiquidacionStatus, {
  label:    string
  dotBg:    string
  badgeBg:  string
  badgeTxt: string
}> = {
  draft: {
    label:    'Borrador',
    dotBg:    'bg-slate',
    badgeBg:  'bg-cream-2',
    badgeTxt: 'text-slate-dark',
  },
  sent: {
    label:    'Enviada',
    dotBg:    'bg-success',
    badgeBg:  'bg-success/10',
    badgeTxt: 'text-success',
  },
  paid: {
    label:    'Pagada',
    dotBg:    'bg-info',
    badgeBg:  'bg-info/10',
    badgeTxt: 'text-info',
  },
}

type StatusFilter = 'todas' | LiquidacionStatus

interface PageProps {
  searchParams: Promise<{ period?: string; status?: string }>
}

export default async function LiquidacionPage({ searchParams }: PageProps) {
  const { period: paramPeriod, status: paramStatus } = await searchParams
  const period = paramPeriod ?? getCurrentPeriod()
  const statusFilter: StatusFilter =
    paramStatus === 'draft' || paramStatus === 'sent' || paramStatus === 'paid'
      ? paramStatus
      : 'todas'

  const [periods, rows] = await Promise.all([
    listTransactionPeriods(),
    getLiquidacionesForPeriod(period),
  ])

  const counts = {
    todas: rows.length,
    draft: rows.filter(r => r.status === 'draft').length,
    sent:  rows.filter(r => r.status === 'sent').length,
    paid:  rows.filter(r => r.status === 'paid').length,
  }

  const filtered = statusFilter === 'todas' ? rows : rows.filter(r => r.status === statusFilter)

  // Totals across the filtered view
  const grandCobrado = filtered.reduce((s, r) => s + r.totalCobrado, 0)
  const grandComision = filtered.reduce((s, r) => s + r.comisionAdmin, 0)
  const grandNeto    = filtered.reduce((s, r) => s + r.netoAlPropietario, 0)

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between gap-3 flex-wrap sm:flex-nowrap mb-2">
          <p className="text-[13px] text-slate-dark min-w-0 truncate flex-1 sm:flex-initial">
            <strong className="text-ink font-medium">Liquidación</strong>
            {' · '}
            {periodLabel(period)}
            {' · '}
            {filtered.length} {filtered.length === 1 ? 'contrato' : 'contratos'}
          </p>
        </div>

        <StickyKPIStrip cols={4}>
          <StickyKPIStripItem>
            <KPICard
              label="Total cobrado"
              value={fmt(grandCobrado)}
              delta={`${periodShort(period)} · todas las cuentas`}
              deltaTone="neutral"
            />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard
              label="Comisión administración"
              value={fmt(grandComision)}
              delta={grandCobrado > 0 ? `${(grandComision / grandCobrado * 100).toFixed(1)}% efectivo` : '—'}
              deltaTone="positive"
            />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard
              label="Neto a propietarios"
              value={fmt(grandNeto)}
              delta="suma de transferencias"
              deltaTone="neutral"
            />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard
              label="Pendientes de envío"
              value={counts.draft.toString()}
              delta={counts.draft > 0 ? 'preparar liquidaciones' : 'todo enviado'}
              deltaTone={counts.draft > 0 ? 'negative' : 'positive'}
            />
          </StickyKPIStripItem>
        </StickyKPIStrip>
      </StickyHeader>

      {/* Period selector + status filter */}
      <section className="mt-4 bg-paper border border-line rounded shadow-card p-3 sm:p-4">
        <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          <span className="label-cap text-slate mr-1 shrink-0">Período</span>
          {periods.map(p => (
            <Link
              key={p}
              href={`/liquidacion?period=${p}${statusFilter !== 'todas' ? `&status=${statusFilter}` : ''}`}
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

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="label-cap text-slate mr-1">Estado</span>
          <FilterPill label="Todas" count={counts.todas} active={statusFilter === 'todas'} period={period} status="todas" />
          <FilterPill label="Borrador" count={counts.draft} active={statusFilter === 'draft'} period={period} status="draft" tone="slate" />
          <FilterPill label="Enviadas" count={counts.sent}  active={statusFilter === 'sent'}  period={period} status="sent"  tone="success" />
          <FilterPill label="Pagadas"  count={counts.paid}  active={statusFilter === 'paid'}  period={period} status="paid"  tone="info" />
        </div>
      </section>

      {/* Per-contract table — Alejandro's per-contract view of the embudo */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Liquidaciones por contrato</h2>
          <p className="text-[12px] text-slate mt-0.5">
            Una línea por contrato/período · alquiler + recuperos consolidados · comisión calculada sobre el total cobrado
          </p>
        </div>
        <div className="overflow-x-auto">
          {filtered.length > 0 ? (
            <table className="w-full text-[13px] min-w-[960px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Inquilino</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Propietario</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Total cobrado</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Comisión</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Otros</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Neto al propietario</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const theme = STATUS_THEME[r.status]
                  const zebra = idx % 2 === 0 ? 'bg-cream/40' : ''
                  return (
                    <ClickableRow
                      key={`${r.contractId}-${r.landlordId}`}
                      href={`/liquidacion/${r.contractId}?period=${period}`}
                      className={`${zebra} hover:bg-cream-2 transition-colors border-b border-line/30`}
                    >
                      <td className="px-4 py-1.5 text-ink font-medium border-r border-line/30">
                        {r.tenantName}
                        {r.hasMultipleLandlords && (
                          <span className="ml-2 text-[10px] text-slate" title="El contrato tiene varios propietarios — sólo se muestra el principal">
                            ⓘ co-propiedad
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-slate-dark border-r border-line/30 truncate max-w-[220px]">{r.landlordName}</td>
                      <td className="px-4 py-1.5 text-ink tabular-nums text-right font-medium border-r border-line/30">{fmt(r.totalCobrado)}</td>
                      <td className="px-4 py-1.5 text-slate-dark tabular-nums text-right border-r border-line/30">
                        {fmt(r.comisionAdmin)}
                        {r.totalCobrado > 0 && (
                          <span className="ml-1 text-[10px] text-slate">({r.comisionPct.toFixed(1)}%)</span>
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-slate-dark tabular-nums text-right border-r border-line/30">
                        {r.otrosDescuentos > 0 ? fmt(r.otrosDescuentos) : '—'}
                      </td>
                      <td className={`px-4 py-1.5 tabular-nums text-right font-medium border-r border-line/30 ${r.netoAlPropietario < 0 ? 'text-danger' : 'text-ink'}`}>
                        {fmt(r.netoAlPropietario)}
                      </td>
                      <td className="px-4 py-1.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${theme.badgeBg} ${theme.badgeTxt}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${theme.dotBg}`} />
                          {theme.label}
                        </span>
                      </td>
                    </ClickableRow>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[14px] text-slate">
                {statusFilter === 'todas'
                  ? `No hay liquidaciones para ${periodLabel(period)}`
                  : `Ninguna liquidación con estado "${STATUS_THEME[statusFilter as LiquidacionStatus].label}"`}
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

function FilterPill({
  label, count, active, period, status, tone = 'slate',
}: {
  label:  string
  count:  number
  active: boolean
  period: string
  status: 'todas' | LiquidacionStatus
  tone?:  'slate' | 'success' | 'info'
}) {
  const dotCls =
    tone === 'success' ? 'bg-success' :
    tone === 'info'    ? 'bg-info'    :
                         'bg-slate'
  return (
    <Link
      href={status === 'todas' ? `/liquidacion?period=${period}` : `/liquidacion?period=${period}&status=${status}`}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors',
        active
          ? 'bg-cream-2 text-ink border-ink/40 ring-1 ring-ink/20 hover:bg-cream'
          : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
      ].join(' ')}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
      {label}
      <span className="inline-flex items-center justify-center text-[10px] font-medium tabular-nums px-1.5 rounded bg-line/60 text-slate-dark">
        {count}
      </span>
    </Link>
  )
}
