import Link from 'next/link'
import { listTransactionPeriods, listTransactions } from '@/lib/entities/queries'

// Force dynamic rendering on every request — the planilla shows the
// encargada's edits, and Next.js 15's default RSC cache occasionally
// serves stale data after `router.refresh()` even when revalidatePath
// has been called from a Server Action. Marking this page explicitly
// dynamic guarantees a fresh server query every time the route is
// requested. The page already uses await searchParams + cookies, but
// the explicit directive is a defensive guard.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
import { getCurrentPeriod, periodLabel, periodShort } from '@/lib/period'
import { getLiquidacionGridForPeriod, getGridDiagnostic, sumGridTotals, type LiquidacionStatus } from '@/lib/liquidacion/queries'
import { getReconciliationByDestination } from '@/lib/reconciliation/queries'
import { listLandlordOptions } from '@/lib/landlord/queries'
import { listTenantOptions } from '@/lib/tenant/queries'
import { listPropertyOptions } from '@/lib/property/queries'
import { LiquidacionGrid } from '@/components/liquidacion/LiquidacionGrid'
import { EmptyGridDiagnostic } from '@/components/liquidacion/EmptyGridDiagnostic'
import { HighlightScroller } from '@/components/liquidacion/HighlightScroller'
import { NewContractModal } from '@/components/liquidacion/NewContractModal'
import { ResumenView } from '@/components/liquidacion/ResumenView'
import { MovimientosView } from '@/components/liquidacion/MovimientosView'
import { DestinosView } from '@/components/liquidacion/DestinosView'
import { fmtMoney as fmt } from '@/lib/format'

type StatusFilter = 'todas' | LiquidacionStatus
type View         = 'grilla' | 'resumen' | 'movimientos' | 'destinos'

interface PageProps {
  searchParams: Promise<{ period?: string; status?: string; view?: string }>
}

const VIEWS: { key: View; label: string }[] = [
  { key: 'grilla',      label: 'Grilla' },
  { key: 'resumen',     label: 'Resumen del período' },
  { key: 'movimientos', label: 'Movimientos' },
  { key: 'destinos',    label: 'Por cuenta destino' },
]

export default async function LiquidacionPage({ searchParams }: PageProps) {
  const { period: paramPeriod, status: paramStatus, view: paramView } = await searchParams
  const period = paramPeriod ?? getCurrentPeriod()
  const statusFilter: StatusFilter =
    paramStatus === 'draft' || paramStatus === 'sent' || paramStatus === 'paid'
      ? paramStatus
      : 'todas'
  const view: View =
    paramView === 'resumen' || paramView === 'movimientos' || paramView === 'destinos'
      ? paramView
      : 'grilla'

  // The grid data is needed for the grid view AND for the resumen view
  // (totals derive from the same rows). Periods always. Landlord/tenant
  // option lists feed the autocomplete in the editable Propietario/Inquilino
  // cells — only loaded when the grilla tab is active.
  //
  // Each fetch is wrapped in its OWN try/catch so that:
  //   1. One failing query doesn't take down the whole page (the planilla
  //      can still render with the data that DID load).
  //   2. The actual error message + stack survive into the UI. Next.js's
  //      default error boundary strips messages in production builds; by
  //      catching here we bypass that and can show Alejandro / us exactly
  //      what threw.
  //
  // `pageErrors` collects {source, message, stack} for any failed fetch.
  // The render block displays them in a bright red banner at the top of
  // the page so a single broken query is obvious and actionable.
  type PageError = { source: string; message: string; stack: string | null }
  const pageErrors: PageError[] = []

  async function safe<T>(source: string, fallback: T, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const stack   = err instanceof Error ? (err.stack ?? null) : null
      pageErrors.push({ source, message, stack })
      console.error(`[/liquidacion] ${source} threw:`, err)
      return fallback
    }
  }

  const needsGrid = view === 'grilla' || view === 'resumen'
  const [periods, allRows, txns, buckets, landlordOptions, tenantOptions, propertyOptions] = await Promise.all([
    safe('listTransactionPeriods',    [],   () => listTransactionPeriods()),
    safe('getLiquidacionGridForPeriod', [], () => needsGrid              ? getLiquidacionGridForPeriod(period)   : Promise.resolve([])),
    safe('listTransactions',          [],   () => view === 'movimientos' ? listTransactions(period)               : Promise.resolve([])),
    safe('getReconciliationByDestination', [], () => view === 'destinos' ? getReconciliationByDestination(period) : Promise.resolve([])),
    safe('listLandlordOptions',       [],   () => view === 'grilla'      ? listLandlordOptions()                  : Promise.resolve([])),
    safe('listTenantOptions',         [],   () => view === 'grilla'      ? listTenantOptions()                    : Promise.resolve([])),
    safe('listPropertyOptions',       [],   () => view === 'grilla'      ? listPropertyOptions()                  : Promise.resolve([])),
  ])

  // When the grid returns zero rows, fetch the diagnostic snapshot so the
  // empty state can surface WHY (no contracts / no active / no junctions / …).
  const gridDiagnostic = needsGrid && allRows.length === 0
    ? await safe('getGridDiagnostic', null, () => getGridDiagnostic(period))
    : null

  // Status filter — applies to the grid view (only)
  const counts = {
    todas: allRows.length,
    draft: allRows.filter(r => r.status === 'draft').length,
    sent:  allRows.filter(r => r.status === 'sent').length,
    paid:  allRows.filter(r => r.status === 'paid').length,
  }
  const rows = statusFilter === 'todas' ? allRows : allRows.filter(r => r.status === statusFilter)

  // KPIs — header strip uses the grid totals when available, falls back when not
  const baseRows      = view === 'grilla' ? rows : allRows
  const cobrados      = baseRows.filter(r => !!r.fechaBanco).length
  const pendientes    = baseRows.length - cobrados
  const totalIngresos = baseRows.reduce((s, r) => s + r.ingresos, 0)
  const totalAdmi     = baseRows.reduce((s, r) => s + r.admi, 0)
  const conAumento    = baseRows.filter(r => r.hasUpcomingAdjustment).length

  const linkWith = (overrides: Partial<{ period: string; status: StatusFilter; view: View }>) => {
    const merged = { period, status: statusFilter, view, ...overrides }
    const qs = new URLSearchParams()
    if (merged.period)                                  qs.set('period', merged.period)
    if (merged.status && merged.status !== 'todas')     qs.set('status', merged.status)
    if (merged.view   && merged.view   !== 'grilla')    qs.set('view',   merged.view)
    return qs.size > 0 ? `/liquidacion?${qs.toString()}` : '/liquidacion'
  }

  return (
    <>
      {/* ─── Diagnostic banner: visible only when one of the data fetches
              threw. Surfaces the real error message + stack (which
              Next.js's default production error page strips) so the
              actual bug is one click away — instead of a cryptic digest. */}
      {pageErrors.length > 0 && (
        <div className="bg-danger/10 border border-danger/40 rounded p-3 mb-3 text-[12px]">
          <p className="font-medium text-danger mb-1">
            ⚠ {pageErrors.length} {pageErrors.length === 1 ? 'consulta falló' : 'consultas fallaron'} al armar esta página
          </p>
          <ul className="space-y-2">
            {pageErrors.map((e, i) => (
              <li key={i} className="border-t border-danger/20 pt-2 first:border-t-0 first:pt-0">
                <p className="font-mono text-[11px] text-ink">
                  <strong>{e.source}:</strong> {e.message}
                </p>
                {e.stack && (
                  <details className="mt-1">
                    <summary className="text-[10px] text-slate cursor-pointer">stack trace</summary>
                    <pre className="text-[10px] text-slate-dark whitespace-pre-wrap break-words mt-1 max-h-40 overflow-auto">
                      {e.stack}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Top section: ALWAYS-VISIBLE header. Filter strip lives here too
              so it never scrolls away (the user complaint about the
              `+ Nuevo contrato` row disappearing when scrolling). The
              wrapper is `flex-none` inside the page's flex column, so it
              takes its natural height and the grid below takes the rest. */}
      <div className="flex-none">
        <div className="flex items-baseline justify-between gap-3 flex-wrap sm:flex-nowrap mb-1">
          <p className="text-[13px] text-slate-dark min-w-0 truncate flex-1 sm:flex-initial">
            <strong className="text-ink font-medium">Liquidación</strong>
            {' · '}
            {periodLabel(period)}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden mb-1.5">
          {VIEWS.map(v => (
            <Link
              key={v.key}
              href={linkWith({ view: v.key })}
              className={[
                'inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors shrink-0 border',
                v.key === view
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-paper text-slate-dark border-line hover:bg-cream-2 hover:text-ink',
              ].join(' ')}
            >
              {v.label}
            </Link>
          ))}
        </div>

        {/* Compact KPI strip — passive metrics. */}
        {view !== 'movimientos' && view !== 'destinos' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mb-2">
            <MiniKpi label="Cobrados"       value={`${cobrados} / ${baseRows.length}`} hint={pendientes > 0 ? `${pendientes} sin cobrar` : 'todo cobrado'} tone={pendientes > 0 ? 'warn' : 'success'} />
            <MiniKpi label="Total cobrado"  value={fmt(totalIngresos)}                hint={`${periodShort(period)}`} tone="ink" />
            <MiniKpi label="Comisión"       value={fmt(totalAdmi)}                    hint={totalIngresos > 0 ? `${(totalAdmi / totalIngresos * 100).toFixed(1)}%` : '—'} tone="success" />
            <MiniKpi label="Aumentos ≤30d"  value={conAumento.toString()}             hint={conAumento > 0 ? 'avisos pendientes' : 'sin novedades'} tone={conAumento > 0 ? 'warn' : 'slate'} />
          </div>
        )}

        {/* Inline filter strip — Period always; Estado + Nuevo on grilla only. */}
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11.5px] pb-2">
          <span className="label-cap text-slate shrink-0">Período</span>
          <div className="flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {periods.map(p => (
              <Link
                key={p}
                href={linkWith({ period: p })}
                className={[
                  'inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium transition-colors shrink-0',
                  p === period
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
                ].join(' ')}
              >
                {periodShort(p)}
              </Link>
            ))}
          </div>

          {view === 'grilla' && (
            <>
              <span className="label-cap text-slate shrink-0 ml-3">Estado</span>
              <div className="flex items-center gap-1 flex-wrap">
                <StatusPill href={linkWith({ status: 'todas' })} active={statusFilter === 'todas'} label="Todas"    count={counts.todas} />
                <StatusPill href={linkWith({ status: 'draft' })} active={statusFilter === 'draft'} label="Borrador" count={counts.draft} tone="slate" />
                <StatusPill href={linkWith({ status: 'sent'  })} active={statusFilter === 'sent'}  label="Enviadas" count={counts.sent}  tone="success" />
                <StatusPill href={linkWith({ status: 'paid'  })} active={statusFilter === 'paid'}  label="Pagadas"  count={counts.paid}  tone="info" />
              </div>

              <div className="ml-auto">
                <NewContractModal
                  landlordOptions={landlordOptions}
                  tenantOptions={tenantOptions}
                  propertyOptions={propertyOptions}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Bottom section: the planilla / view content. Takes all remaining
              vertical space (min-h-0 is required so the flex child can
              shrink and contain its own scroll). */}
      <div className="flex-1 min-h-0">
        {/* Diagnostic banner — surfaces what's actually in the DB when the
            grid would otherwise show only "no contracts" with no clue why. */}
        {needsGrid && allRows.length === 0 && gridDiagnostic && (
          <EmptyGridDiagnostic diagnostic={gridDiagnostic} />
        )}

        {view === 'grilla' && (
          <>
            {/* Reads ?highlight=<contractId> on mount and scrolls/pulses
                that row. Used by the "Ver fila →" jumps from /pendientes. */}
            <HighlightScroller />
            <LiquidacionGrid rows={rows} totals={sumGridTotals(rows)} period={period} landlordOptions={landlordOptions} tenantOptions={tenantOptions} />
          </>
        )}
        {view === 'resumen'     && <div className="h-full overflow-auto"><ResumenView    rows={allRows} period={period} /></div>}
        {view === 'movimientos' && <div className="h-full overflow-auto"><MovimientosView txns={txns}   period={period} /></div>}
        {view === 'destinos'    && <div className="h-full overflow-auto"><DestinosView   buckets={buckets} period={period} /></div>}
      </div>
    </>
  )
}

function StatusPill({
  href, active, label, count, tone = 'neutral',
}: {
  href:   string
  active: boolean
  label:  string
  count:  number
  tone?:  'neutral' | 'slate' | 'success' | 'info'
}) {
  const dotCls =
    tone === 'success' ? 'bg-success' :
    tone === 'info'    ? 'bg-info'    :
    tone === 'slate'   ? 'bg-slate'   :
                         'bg-slate/40'
  return (
    <Link
      href={href}
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

// Compact KPI tile — passive metric for the sticky header. Smaller than
// the KPICard used elsewhere in the app; tuned for /liquidacion where
// vertical real estate is at a premium and the planilla is the focus.
function MiniKpi({
  label, value, hint, tone,
}: {
  label: string
  value: string
  hint:  string
  tone:  'ink' | 'success' | 'warn' | 'slate'
}) {
  const valueColor =
    tone === 'success' ? 'text-success' :
    tone === 'warn'    ? 'text-warn'    :
    tone === 'slate'   ? 'text-slate-dark' :
                         'text-ink'
  return (
    <div className="flex items-baseline justify-between gap-2 bg-paper/70 border border-line/60 rounded px-2 py-1 min-w-0">
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-slate truncate">{label}</p>
        <p className="text-[10px] text-slate truncate">{hint}</p>
      </div>
      <p className={`font-display font-medium tabular-nums text-[14px] shrink-0 ${valueColor}`}>{value}</p>
    </div>
  )
}
