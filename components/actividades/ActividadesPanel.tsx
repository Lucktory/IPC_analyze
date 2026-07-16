'use client'

// ============================================================================
// ActividadesPanel — the "Panel" (charts) view of the audit log. Summarizes
// the currently-filtered activity (a specific employee via Usuario, a specific
// contract via Contrato, or everything) into KPIs + charts, reusing the same
// ECharts/HTML chart components that power /dashboard. No new dependency.
//
// Adaptive: when an employee is selected the last card shows the contracts they
// touched; otherwise it shows who acted (who modified the contract / most
// active users).
// ============================================================================

import { DashboardCard } from '@/components/charts/panel/DashboardCard'
import { DonutPanel } from '@/components/charts/panel/DonutPanel'
import { SortedHorizontalBars } from '@/components/charts/panel/SortedHorizontalBars'
import { MonthlyBars } from '@/components/charts/panel/MonthlyBars'
import type { AuditAnalytics } from '@/lib/audit/types'

// Semantic action colors — same hues as the table's action badges.
const COLORS = { created: '#16A34A', updated: '#3B82F6', deleted: '#DC2626', session: '#8A93A5' }
const BAR_ENTITY  = '#3B82F6'
const BAR_ADAPTIVE = '#8B5CF6'

interface Props {
  analytics: AuditAnalytics
  filters:   { actor: string; from: string; to: string; group: string; q: string }
}

export function ActividadesPanel({ analytics, filters }: Props) {
  if (analytics.total === 0) {
    return (
      <div className="bg-paper border border-line rounded-xl shadow-card px-6 py-16 text-center">
        <p className="text-[14px] text-slate">Sin actividades para estos filtros.</p>
        <p className="text-[12.5px] text-slate mt-1">Proba con otro usuario, contrato o rango de fechas.</p>
      </div>
    )
  }

  const totalLabel = analytics.capped ? `${analytics.total}+` : String(analytics.total)

  const donutItems = [
    { label: 'Creaciones',    value: analytics.created, color: COLORS.created },
    { label: 'Ediciones',     value: analytics.updated, color: COLORS.updated },
    { label: 'Eliminaciones', value: analytics.deleted, color: COLORS.deleted },
    { label: 'Sesiones',      value: analytics.session, color: COLORS.session },
  ].filter(i => i.value > 0)

  const entityItems = analytics.byEntity.map(b => ({ ...b, color: BAR_ENTITY }))

  // Adaptive last card.
  const byEmployee     = !!filters.actor
  const adaptive       = byEmployee ? analytics.byContract : analytics.byActor
  const adaptiveTitle  = byEmployee ? 'Contratos mas tocados'
    : filters.q ? 'Quien lo modifico' : 'Usuarios mas activos'
  const adaptiveItems  = adaptive.map(b => ({ ...b, color: BAR_ADAPTIVE }))

  const timePoints = analytics.timeBuckets.map(b => ({ label: b.label, value: b.value }))
  const lastLabel  = analytics.lastActivity ? fmtDateTime(analytics.lastActivity) : '-'

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Total acciones" value={totalLabel} />
        <Kpi label="Creaciones"     value={analytics.created}        dot={COLORS.created} />
        <Kpi label="Ediciones"      value={analytics.updated}        dot={COLORS.updated} />
        <Kpi label="Eliminaciones"  value={analytics.deleted}        dot={COLORS.deleted} />
        <Kpi label="Sesiones"       value={analytics.session}        dot={COLORS.session} />
        <Kpi label="Usuarios"       value={analytics.distinctActors} />
      </div>

      {analytics.capped && (
        <p className="text-[11.5px] text-slate">
          Mostrando los {analytics.total} eventos mas recientes. Acota el rango de fechas para un resumen mas preciso.
        </p>
      )}

      <DashboardCard title="Actividad en el tiempo" subtitle={`Ultima actividad: ${lastLabel}`}>
        <MonthlyBars points={timePoints} format="integer" height={220} color={BAR_ENTITY} />
      </DashboardCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardCard title="Por tipo de accion">
          <DonutPanel items={donutItems} legendPosition="bottom" totalUnit="acciones" centerText={totalLabel} height={200} />
        </DashboardCard>
        <DashboardCard title="Por entidad" subtitle="Que registros se tocaron">
          <SortedHorizontalBars items={entityItems} />
        </DashboardCard>
      </div>

      <DashboardCard title={adaptiveTitle}>
        <SortedHorizontalBars items={adaptiveItems} />
      </DashboardCard>
    </div>
  )
}

function Kpi({ label, value, dot }: { label: string; value: string | number; dot?: string }) {
  return (
    <div className="bg-paper border border-line rounded-xl px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-slate truncate flex items-center gap-1.5">
        {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />}
        {label}
      </p>
      <p className="font-display text-[22px] font-semibold tabular-nums leading-tight mt-0.5 text-ink">{value}</p>
    </div>
  )
}

function fmtDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date(iso))
  } catch { return iso }
}
