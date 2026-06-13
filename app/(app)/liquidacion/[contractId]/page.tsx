import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { getCurrentPeriod, periodLabel } from '@/lib/period'
import { getLiquidacionDetail, type LiquidacionDetailLine, type LiquidacionStatus } from '@/lib/liquidacion/queries'
import { fmtMoney as fmt, fmtDate, fmtDateTime } from '@/lib/format'
import { LiquidacionActionsBar } from '@/components/liquidacion/LiquidacionActionsBar'
import { GenerateCommissionButton } from '@/components/liquidacion/GenerateCommissionButton'
import { PrintButton } from '@/components/ui/PrintButton'

const STATUS_THEME: Record<LiquidacionStatus, { label: string; dot: string; tint: string; text: string; border: string }> = {
  draft: { label: 'Borrador', dot: 'bg-slate',   tint: 'bg-cream-2',     text: 'text-slate-dark', border: 'border-l-slate' },
  sent:  { label: 'Enviada',  dot: 'bg-success', tint: 'bg-success/10', text: 'text-success',     border: 'border-l-success' },
  paid:  { label: 'Pagada',   dot: 'bg-info',    tint: 'bg-info/10',    text: 'text-info',        border: 'border-l-info'    },
}

interface PageProps {
  params:       Promise<{ contractId: string }>
  searchParams: Promise<{ period?: string }>
}

export default async function LiquidacionDetailPage({ params, searchParams }: PageProps) {
  const { contractId } = await params
  const { period: paramPeriod } = await searchParams
  const period = paramPeriod ?? getCurrentPeriod()

  const detail = await getLiquidacionDetail(contractId, period)
  if (!detail) notFound()

  const theme = STATUS_THEME[detail.status]
  const total = detail.totalCobrado
  const pctComision  = total > 0 ? (detail.comisionAdmin    / total) * 100 : 0
  const pctOtros     = total > 0 ? (detail.otrosDescuentos  / total) * 100 : 0
  const pctNeto      = total > 0 ? (detail.netoAlPropietario / total) * 100 : 0

  // Group breakdown lines: IN above (rent + recuperos), OUT below (comisión + otros)
  const ins  = detail.lines.filter(l => l.direction === 'IN')
  const outs = detail.lines.filter(l => l.direction === 'OUT')

  return (
    <>
      <BreadcrumbTitle name={`${detail.tenantName} · ${periodLabel(period)}`} />

      <div className="mb-6 flex items-center justify-between flex-wrap gap-3 print:hidden">
        <Link href={`/liquidacion?period=${period}`} className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          ← Volver a liquidaciones
        </Link>
        <PrintButton label="Imprimir / PDF" />
      </div>

      {/* Header: tenant + landlord + status pill */}
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="label-cap text-slate">Liquidación · {periodLabel(period)}</p>
          <h1 className="font-display text-[22px] font-medium text-ink mt-1">{detail.tenantName}</h1>
          <p className="text-[13px] text-slate-dark mt-1">
            Propietario: <strong className="text-ink font-medium">{detail.landlordName}</strong>
            {detail.hasMultipleLandlords && (
              <span className="ml-2 text-[11px] text-slate">· contrato con varios propietarios (mostrando principal)</span>
            )}
          </p>
        </div>
        <Badge tone={detail.status === 'paid' ? 'info' : detail.status === 'sent' ? 'success' : 'neutral'}>
          {theme.label}
        </Badge>
      </div>

      {/* Embudo — horizontal stacked bar showing the funnel */}
      <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">Embudo del período</h2>
            <p className="text-[12px] text-slate mt-0.5">
              Total cobrado al inquilino → comisión administración + otros descuentos → neto al propietario
            </p>
          </div>
          {total > 0 && (
            <div className="print:hidden">
              <GenerateCommissionButton contractId={detail.contractId} period={detail.period} />
            </div>
          )}
        </div>
        <div className="p-5">
          {total > 0 ? (
            <>
              {/* Big total at the top */}
              <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
                <div>
                  <p className="label-cap text-slate mb-1">Total cobrado al inquilino</p>
                  <p className="font-display text-[28px] font-semibold tabular-nums text-ink leading-none">{fmt(total)}</p>
                </div>
                <p className="text-[11px] text-slate text-right">
                  Comisión efectiva: <strong className="text-ink tabular-nums">{pctComision.toFixed(1)}%</strong>
                </p>
              </div>

              {/* Stacked bar */}
              <div className="flex h-4 rounded-full overflow-hidden bg-cream-2 mb-3">
                {detail.comisionAdmin > 0 && (
                  <div
                    title={`Comisión: ${fmt(detail.comisionAdmin)} (${pctComision.toFixed(1)}%)`}
                    style={{ width: `${pctComision}%`, backgroundColor: '#16A34A' }}
                  />
                )}
                {detail.otrosDescuentos > 0 && (
                  <div
                    title={`Otros descuentos: ${fmt(detail.otrosDescuentos)} (${pctOtros.toFixed(1)}%)`}
                    style={{ width: `${pctOtros}%`, backgroundColor: '#F39C12' }}
                  />
                )}
                {detail.netoAlPropietario > 0 && (
                  <div
                    title={`Neto al propietario: ${fmt(detail.netoAlPropietario)} (${pctNeto.toFixed(1)}%)`}
                    style={{ width: `${pctNeto}%`, backgroundColor: '#3B82F6' }}
                  />
                )}
              </div>

              {/* Three tinted cards underneath */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <EmbudoStat
                  accent="#16A34A"
                  label="Comisión administración"
                  value={fmt(detail.comisionAdmin)}
                  pct={pctComision}
                />
                <EmbudoStat
                  accent="#F39C12"
                  label="Otros descuentos"
                  value={fmt(detail.otrosDescuentos)}
                  pct={pctOtros}
                  muted={detail.otrosDescuentos === 0}
                />
                <EmbudoStat
                  accent="#3B82F6"
                  label="Neto al propietario"
                  value={fmt(detail.netoAlPropietario)}
                  pct={pctNeto}
                  highlight
                />
              </div>
            </>
          ) : (
            <p className="text-[13px] text-slate py-6 text-center">
              Sin transacciones registradas para este período.
            </p>
          )}
        </div>
      </section>

      {/* Status actions — hidden in print */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card p-5 print:hidden">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-medium text-ink">Estado de la liquidación</h2>
            <p className="text-[12px] text-slate mt-0.5">
              Flujo: <strong className="text-slate-dark">Borrador</strong> → <strong className="text-success">Enviada</strong> → <strong className="text-info">Pagada</strong>
            </p>
            {detail.sentAt && (
              <p className="text-[11px] text-slate mt-2 tabular-nums">
                Enviada el {fmtDateTime(detail.sentAt)}
              </p>
            )}
            {detail.paidAt && (
              <p className="text-[11px] text-slate mt-0.5 tabular-nums">
                Pagada el {fmtDateTime(detail.paidAt)}
              </p>
            )}
          </div>
          <LiquidacionActionsBar
            contractId={detail.contractId}
            landlordId={detail.landlordId}
            period={detail.period}
            status={detail.status}
          />
        </div>
      </section>

      {/* Breakdown — transactions that contributed to the embudo */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Desglose de transacciones</h2>
          <p className="text-[12px] text-slate mt-0.5">
            {detail.lines.length} {detail.lines.length === 1 ? 'movimiento' : 'movimientos'} en {periodLabel(period)}
          </p>
        </div>
        <div className="overflow-x-auto">
          {detail.lines.length > 0 ? (
            <table className="w-full text-[13px] min-w-[680px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Fecha</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Tipo</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Descripción</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                <BreakdownGroup title="Ingresos cobrados al inquilino" lines={ins}  emptyText="Sin ingresos en el período" />
                <BreakdownGroup title="Salidas (comisión + otros)"     lines={outs} emptyText="Sin egresos en el período" />
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[13px] text-slate">Sin movimientos registrados</p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
function EmbudoStat({
  accent, label, value, pct, muted = false, highlight = false,
}: {
  accent:    string
  label:     string
  value:     string
  pct:       number
  muted?:    boolean
  highlight?: boolean
}) {
  const bgTint = muted ? 'rgba(125,132,145,0.05)' : hexToRgba(accent, 0.10)
  return (
    <div
      className={`rounded-md border-l-[3px] px-3 py-3 ${highlight ? 'shadow-card' : ''}`}
      style={{ borderLeftColor: accent, backgroundColor: bgTint }}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: muted ? '#7D8491' : accent }}>
        {label}
      </p>
      <p className="font-display text-[20px] font-semibold tabular-nums leading-none text-ink">
        {value}
      </p>
      {!muted && (
        <p className="text-[10px] text-slate mt-1.5 tabular-nums">{pct.toFixed(1)}% del total</p>
      )}
    </div>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)}, ${alpha})`
}

function BreakdownGroup({
  title, lines, emptyText,
}: {
  title:     string
  lines:     LiquidacionDetailLine[]
  emptyText: string
}) {
  if (lines.length === 0) {
    return (
      <tr>
        <td colSpan={4} className="px-4 py-2 text-[12px] text-slate bg-cream/40 italic">
          {title}: {emptyText.toLowerCase()}
        </td>
      </tr>
    )
  }
  return (
    <>
      <tr>
        <td colSpan={4} className="px-4 py-1.5 text-[11px] font-medium label-cap text-slate bg-cream/60 border-y border-line/40">
          {title}
        </td>
      </tr>
      {lines.map(l => {
        const isIn = l.direction === 'IN'
        const sign = isIn ? '+ ' : '− '
        return (
          <tr key={l.transactionId} className={`border-b border-line/20 ${l.affectsLiquidacion ? '' : 'opacity-60'}`}>
            <td className="px-4 py-1.5 text-slate-dark tabular-nums border-r border-line/30">
              {l.bankDate ? fmtDate(l.bankDate) : '—'}
            </td>
            <td className="px-4 py-1.5 text-ink border-r border-line/30">
              {l.typeLabel}
              {!l.affectsLiquidacion && (
                <span className="ml-2 text-[10px] text-slate italic">(no afecta liquidación)</span>
              )}
            </td>
            <td className="px-4 py-1.5 text-slate-dark text-[12px] border-r border-line/30 truncate max-w-[280px]">
              {l.description ?? '—'}
            </td>
            <td className={`px-4 py-1.5 text-right tabular-nums font-medium ${isIn ? 'text-success' : 'text-danger'}`}>
              {sign}{fmt(l.amount)}
            </td>
          </tr>
        )
      })}
    </>
  )
}

// Re-export fmt for the BreakdownGroup component which is defined outside.
// (Module-level `fmt` import covers it; this comment is to flag the dependency.)
