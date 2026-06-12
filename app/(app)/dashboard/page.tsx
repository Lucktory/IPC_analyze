// ============================================================================
// Panel ejecutivo — four detail tables, each answering one question at a glance.
//
//   1. Movimientos del mes     → "What's happening right now?"
//   2. Acciones pendientes     → "What do I need to do this week?"
//   3. Resumen mensual         → "How is the business trending?"
//   4. Top propietarios        → "Who are my biggest clients?"
//
// Tables (not charts) because rental admin work is name-and-number specific:
// the user needs to see "Juan Rodríguez owes $180.000, 8 days late", not a
// donut slice. Charts hide identity; tables surface it.
// ============================================================================

import Link from 'next/link'
import {
  getMonthlyIncomeTrend,
  getOperationalTrends,
  getTopLandlords,
} from '@/lib/dashboard/queries'
import { listPendingActions, CATEGORY_LABEL } from '@/lib/pending/queries'
import type { PendingCategory } from '@/lib/pending/queries'
import { listTransactions } from '@/lib/entities/queries'
import { getCurrentPeriod, getCurrentPeriodLabel, periodLabel as fullPeriodLabel } from '@/lib/period'
import { fmtMoney, fmtTime } from '@/lib/format'
import { DashboardCard } from '@/components/charts/panel/DashboardCard'

const MAX_ROWS = 8

// ── Category styling helpers ────────────────────────────────────────────────
const CATEGORY_DOT: Record<PendingCategory, string> = {
  cobranza:   'bg-danger',
  aumento:    'bg-warn',
  renovacion: 'bg-info',
}

// ── Plazo formatter: -8 → "8d atraso", 5 → "en 5d", 0 → "hoy" ──────────────
function fmtPlazo(daysUntilDeadline: number): { text: string; tone: 'danger' | 'warn' | 'ok' } {
  if (daysUntilDeadline <= 0) {
    const overdue = Math.abs(daysUntilDeadline)
    return {
      text: overdue === 0 ? 'hoy' : `${overdue} d atraso`,
      tone: 'danger',
    }
  }
  if (daysUntilDeadline <= 7) return { text: `en ${daysUntilDeadline} d`, tone: 'warn' }
  return { text: `en ${daysUntilDeadline} d`, tone: 'ok' }
}

// ── Bank-date formatter: "2026-06-08" → "08/06" ─────────────────────────────
function fmtShortDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default async function DashboardPage() {
  const period = getCurrentPeriod()
  const [recentTx, pending, incomeTrend, opsTrend, topLandlords] = await Promise.all([
    listTransactions(period),
    listPendingActions(),
    getMonthlyIncomeTrend(6),
    getOperationalTrends(6),
    getTopLandlords(MAX_ROWS),
  ])

  // ── Build month-summary rows from the two trend series, newest first ──
  const monthly = incomeTrend.map((m, i) => {
    const prev    = incomeTrend[i - 1]?.value
    const delta   = prev != null && prev !== 0 ? ((m.value - prev) / prev) * 100 : null
    const ops     = opsTrend[i]
    return {
      period:     m.period,
      label:      m.label,
      income:     m.value,
      delta,
      commission: ops?.comisiones ?? 0,
      payments:   ops?.pagos ?? 0,
    }
  }).reverse()  // newest first

  // Top landlords — derive their % share of period total
  const landlordTotal = topLandlords.reduce((s, l) => s + l.revenue, 0)

  return (
    <>
      <header className="mb-6">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <p className="label-cap text-slate">Panel ejecutivo</p>
            <h1 className="font-display text-[22px] font-medium text-ink mt-1">{getCurrentPeriodLabel()}</h1>
          </div>
          <p className="text-[11px] text-slate tabular-nums">
            Actualizado · {fmtTime(new Date())}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* ────────────────────────────────────────────────────────────── */}
        {/* TABLE 1 — Movimientos del mes                                  */}
        {/* ────────────────────────────────────────────────────────────── */}
        <DashboardCard
          title="Movimientos del mes"
          subtitle={`${recentTx.length} ${recentTx.length === 1 ? 'movimiento' : 'movimientos'} en ${getCurrentPeriodLabel()}`}
          topRight={<SeeAllLink href="/movimientos" />}
        >
          {recentTx.length > 0 ? (
            <Table>
              <THead>
                <Th>Fecha</Th>
                <Th>Tipo</Th>
                <Th>Inquilino</Th>
                <Th align="right">Monto</Th>
              </THead>
              <tbody>
                {recentTx.slice(0, MAX_ROWS).map(t => {
                  const isIn = t.direction === 'IN'
                  return (
                    <Tr key={t.id}>
                      <Td className="text-slate-dark tabular-nums">{fmtShortDate(t.bankDate)}</Td>
                      <Td className="text-ink truncate max-w-[160px]">{t.typeLabel}</Td>
                      <Td className="text-slate-dark truncate max-w-[180px]">{t.tenantName ?? '—'}</Td>
                      <Td align="right" className={`tabular-nums font-medium ${isIn ? 'text-success' : 'text-danger'}`}>
                        {isIn ? '+ ' : '− '}{fmtMoney(t.amount)}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          ) : (
            <EmptyState text="Sin movimientos este período" />
          )}
        </DashboardCard>

        {/* ────────────────────────────────────────────────────────────── */}
        {/* TABLE 2 — Acciones pendientes                                  */}
        {/* ────────────────────────────────────────────────────────────── */}
        <DashboardCard
          title="Acciones pendientes"
          subtitle={
            pending.counts.total === 0
              ? 'Todo al día — sin pendientes esta semana'
              : `${pending.counts.total} ${pending.counts.total === 1 ? 'acción' : 'acciones'} esta semana`
          }
          topRight={<SeeAllLink href="/pendientes" />}
        >
          {pending.counts.total > 0 ? (
            <Table>
              <THead>
                <Th>Tipo</Th>
                <Th>Inquilino</Th>
                <Th>Motivo</Th>
                <Th align="right">Plazo</Th>
              </THead>
              <tbody>
                {pending.rows.slice(0, MAX_ROWS).map((p, i) => {
                  const plazo = fmtPlazo(p.daysUntilDeadline)
                  return (
                    <Tr key={`${p.contractId}-${p.category}-${i}`} href={`/contratos/${p.contractId}`}>
                      <Td>
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_DOT[p.category]}`} />
                          <span className="text-ink text-[12px]">{CATEGORY_LABEL[p.category].split(' ')[0]}</span>
                        </span>
                      </Td>
                      <Td className="text-ink truncate max-w-[150px]">{p.tenantName}</Td>
                      <Td className="text-slate-dark text-[12px] truncate max-w-[180px]">{p.reason}</Td>
                      <Td align="right" className={`tabular-nums text-[12px] ${plazo.tone === 'danger' ? 'text-danger font-medium' : plazo.tone === 'warn' ? 'text-warn' : 'text-slate'}`}>
                        {plazo.text}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          ) : (
            <CelebratoryEmpty />
          )}
        </DashboardCard>

        {/* ────────────────────────────────────────────────────────────── */}
        {/* TABLE 3 — Resumen mensual                                      */}
        {/* ────────────────────────────────────────────────────────────── */}
        <DashboardCard
          title="Resumen mensual"
          subtitle={`Últimos ${monthly.length} meses · más reciente arriba`}
          topRight={<SeeAllLink href="/movimientos" />}
        >
          {monthly.length > 0 ? (
            <Table>
              <THead>
                <Th>Mes</Th>
                <Th align="right">Ingresos</Th>
                <Th align="right">Δ</Th>
                <Th align="right">Comisión</Th>
                <Th align="right">Pagos</Th>
              </THead>
              <tbody>
                {monthly.map((m, i) => (
                  <Tr key={m.period}>
                    <Td className={`${i === 0 ? 'text-ink font-medium' : 'text-slate-dark'} capitalize`}>
                      {fullPeriodLabel(m.period)}
                    </Td>
                    <Td align="right" className="tabular-nums text-ink">{fmtMoney(m.income)}</Td>
                    <Td align="right" className="tabular-nums text-[12px]">
                      {m.delta == null
                        ? <span className="text-slate">—</span>
                        : <span className={m.delta >= 0 ? 'text-success' : 'text-danger'}>
                            {m.delta >= 0 ? '↑' : '↓'} {Math.abs(m.delta).toFixed(0)}%
                          </span>}
                    </Td>
                    <Td align="right" className="tabular-nums text-slate-dark">{fmtMoney(m.commission)}</Td>
                    <Td align="right" className="tabular-nums text-slate-dark">{m.payments}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState text="Sin datos históricos" />
          )}
        </DashboardCard>

        {/* ────────────────────────────────────────────────────────────── */}
        {/* TABLE 4 — Top propietarios este período                        */}
        {/* ────────────────────────────────────────────────────────────── */}
        <DashboardCard
          title="Top propietarios"
          subtitle={`Mayor ingreso este período · ${topLandlords.length} con cobros`}
          topRight={<SeeAllLink href="/propietarios" />}
        >
          {topLandlords.length > 0 ? (
            <Table>
              <THead>
                <Th>#</Th>
                <Th>Propietario</Th>
                <Th align="right">Contratos</Th>
                <Th align="right">Ingresos</Th>
                <Th align="right">%</Th>
              </THead>
              <tbody>
                {topLandlords.map((l, i) => {
                  const pct = landlordTotal > 0 ? (l.revenue / landlordTotal) * 100 : 0
                  return (
                    <Tr key={l.name}>
                      <Td className="text-slate tabular-nums w-8">{i + 1}</Td>
                      <Td className="text-ink truncate max-w-[200px]">{l.name}</Td>
                      <Td align="right" className="tabular-nums text-slate-dark">{l.contracts}</Td>
                      <Td align="right" className="tabular-nums text-ink font-medium">{fmtMoney(l.revenue)}</Td>
                      <Td align="right" className="tabular-nums text-slate text-[12px]">{pct.toFixed(0)}%</Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          ) : (
            <EmptyState text="Sin cobros este período" />
          )}
        </DashboardCard>
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Compact table primitives — shared styling so all four tables read the
// same way.
// ────────────────────────────────────────────────────────────────────────────

function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full text-[13px] border-collapse">{children}</table>
}

function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-line">
      <tr>{children}</tr>
    </thead>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`label-cap font-medium text-slate pb-2 px-2 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

function Tr({ children, href }: { children: React.ReactNode; href?: string }) {
  // When `href` is set, the whole row navigates on click (and the cells are
  // wrapped accordingly via a CSS hover state). We don't wrap in <a> because
  // <a> can't be a direct <tr> child — instead, the parent passes the link
  // path and we attach a Link to a hidden full-row overlay.
  return (
    <tr className={`border-b border-line/40 last:border-b-0 ${href ? 'hover:bg-cream-2 transition-colors cursor-pointer relative' : ''}`}>
      {children}
      {href && (
        <td className="absolute inset-0 p-0">
          <Link href={href} className="block w-full h-full" aria-label="Ver detalle" />
        </td>
      )}
    </tr>
  )
}

function Td({
  children,
  align     = 'left',
  className = '',
}: {
  children:   React.ReactNode
  align?:     'left' | 'right'
  className?: string
}) {
  return (
    <td className={`py-2 px-2 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </td>
  )
}

function SeeAllLink({ href }: { href: string }) {
  return (
    <Link href={href} className="text-[11px] text-slate hover:text-ink transition-colors inline-flex items-center gap-0.5">
      Ver todo →
    </Link>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-[13px] text-slate">{text}</p>
    </div>
  )
}

function CelebratoryEmpty() {
  return (
    <div className="py-8 text-center">
      <p className="text-[13px] text-success font-medium">Todo al día</p>
      <p className="text-[12px] text-slate mt-1">No hay acciones pendientes esta semana</p>
    </div>
  )
}

