// ============================================================================
// /movimientos — the period's transaction ledger. 4 month KPIs with real
// month-over-month deltas + a paginated table. Every figure is real: amounts
// are unsigned in the DB, direction comes from transaction_types. Bank is only
// shown for commission rows (ADM_* tag); it is not stored on other rows.
// ============================================================================

import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Wallet, Percent,
  SlidersHorizontal, Plus, ArrowUp, ArrowDown, ChevronRight,
} from 'lucide-react'
import { AutoSearchInput } from '@/components/ui/AutoSearchInput'
import { FilterPill } from '@/components/ui/FilterPill'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { TablePagination } from '@/components/ui/TablePagination'
import { PeriodSelect } from '@/components/charts/panel/PeriodSelect'
import { getMovimientos, getMovimientosSummary, type MovimientoRow } from '@/lib/movimientos/queries'
import { getDashboardPeriod, getPeriodsWithData } from '@/lib/dashboard/queries'
import { buildPeriodTabs, periodLabel, shiftPeriod } from '@/lib/period'
import { fmtMoney as fmt, fmtSignedMoney } from '@/lib/format'

export const dynamic    = 'force-dynamic'
export const fetchCache = 'force-no-store'

const PER_PAGE = 12

const DATE_LABEL = (s: string | null) => {
  if (!s) return '—'
  const [, m, d] = s.split('-')
  return `${d}/${m}`
}

type Dir = 'todos' | 'in' | 'out'

const CATEGORY_LABEL: Record<string, string> = {
  rent: 'Alquiler', commission: 'Comisión', expense: 'Gastos', tax: 'Impuestos',
  utility: 'Servicios', deposit: 'Depósito', refund: 'Reintegros', transfer: 'Transferencias', other: 'Otros',
}

interface PageProps {
  searchParams: Promise<{ period?: string; dir?: string; category?: string; q?: string; page?: string }>
}

export default async function MovimientosPage({ searchParams }: PageProps) {
  const sp       = await searchParams
  const dir      = (sp.dir as Dir) ?? 'todos'
  const category = sp.category ?? 'todas'
  const q        = (sp.q ?? '').trim().toLowerCase()

  const [latest, dataPeriods] = await Promise.all([getDashboardPeriod(), getPeriodsWithData()])
  const validReq = sp.period && /^\d{4}-\d{2}-01$/.test(sp.period) ? sp.period : null
  const period   = validReq ?? latest
  const prev     = shiftPeriod(period, -1)
  const selectorPeriods = buildPeriodTabs(dataPeriods, period, 3)

  const [rows, sum, prevSum] = await Promise.all([
    getMovimientos(period),
    getMovimientosSummary(period),
    getMovimientosSummary(prev),
  ])

  // ── KPI deltas (real, month-over-month) ──────────────────────────────────
  const prevName = periodLabel(prev).split(' ')[0].toLowerCase()
  const delta = (cur: number, base: number): number | null => (base ? ((cur - base) / Math.abs(base)) * 100 : null)
  const kpis = [
    { label: 'Ingresos del mes', value: fmt(sum.ingresos),          Icon: TrendingUp,   color: '#16A34A', d: delta(sum.ingresos, prevSum.ingresos) },
    { label: 'Egresos',          value: fmt(sum.egresos),           Icon: TrendingDown, color: '#EF4444', d: delta(sum.egresos, prevSum.egresos) },
    { label: 'Neto',             value: fmtSignedMoney(sum.neto),   Icon: Wallet,       color: '#3B82F6', d: null, sub: 'ingresos − egresos' },
    { label: 'Comisiones',       value: fmt(sum.comisiones),        Icon: Percent,      color: '#8B5CF6', d: delta(sum.comisiones, prevSum.comisiones) },
  ]

  // ── Filter + paginate the table ──────────────────────────────────────────
  let filtered = rows
  if (dir === 'in')  filtered = filtered.filter(r => r.direction === 'IN')
  if (dir === 'out') filtered = filtered.filter(r => r.direction === 'OUT')
  if (category !== 'todas') filtered = filtered.filter(r => r.category === category)
  if (q) filtered = filtered.filter(r =>
    (r.contractNumber ?? '').toLowerCase().includes(q) ||
    (r.counterparty ?? '').toLowerCase().includes(q) ||
    (r.description ?? '').toLowerCase().includes(q) ||
    r.typeLabel.toLowerCase().includes(q) ||
    (r.bank ?? '').toLowerCase().includes(q))

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const page       = Math.min(Math.max(1, parseInt(sp.page ?? '1', 10) || 1), totalPages)
  const pageRows   = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const fromN      = filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const toN        = Math.min(page * PER_PAGE, filtered.length)

  const buildHref = (o: Partial<Record<string, string>>) => {
    const p = new URLSearchParams()
    const m = { period, dir, category, q, ...o }
    if (m.period && m.period !== latest) p.set('period', m.period)
    if (m.dir && m.dir !== 'todos')      p.set('dir', m.dir)
    if (m.category && m.category !== 'todas') p.set('category', m.category)
    if (m.q) p.set('q', m.q)
    const qs = p.toString()
    return qs ? `/movimientos?${qs}` : '/movimientos'
  }
  const pageHref = (n: number) => {
    const base = buildHref({})
    const sep = base.includes('?') ? '&' : '?'
    return n <= 1 ? base : `${base}${sep}page=${n}`
  }
  // PeriodSelect preserves active filters when switching month.
  const psExtra = new URLSearchParams()
  if (dir !== 'todos')      psExtra.set('dir', dir)
  if (category !== 'todas') psExtra.set('category', category)
  if (sp.q)                 psExtra.set('q', sp.q)

  const filtersActive = dir !== 'todos' || category !== 'todas' || !!q

  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 flex-wrap shrink-0">
        <div>
          <h1 className="text-[26px] font-bold text-ink tracking-tight">Movimientos</h1>
          <nav className="text-[12px] text-slate mt-1 flex items-center gap-1.5">
            <Link href="/dashboard" className="text-info hover:underline">Inicio</Link>
            <span className="text-slate/50">/</span>
            <span className="text-slate-dark">Movimientos</span>
          </nav>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodSelect current={period} periods={selectorPeriods} basePath="/movimientos" extraQuery={psExtra.toString()} />
          <details className="relative">
            <summary className={`list-none inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-[13px] font-medium cursor-pointer transition-colors [&::-webkit-details-marker]:hidden ${
              filtersActive ? 'border-info text-info bg-info/5' : 'border-line text-ink bg-paper hover:border-info/40'
            }`}>
              <SlidersHorizontal size={15} /> Filtros{filtersActive ? ' · activos' : ''}
            </summary>
            <div className="absolute right-0 mt-2 z-30 w-[280px] bg-paper border border-line rounded-xl shadow-lg p-3.5 space-y-3">
              <AutoSearchInput initialValue={sp.q ?? ''} placeholder="Buscar contrato, nombre, tipo…" resetParams={['page']} />
              <div>
                <span className="label-cap text-slate">Dirección</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <FilterPill href={buildHref({ dir: 'in',  page: undefined })} clearHref={buildHref({ dir: 'todos' })} label="Ingresos" active={dir === 'in'} />
                  <FilterPill href={buildHref({ dir: 'out', page: undefined })} clearHref={buildHref({ dir: 'todos' })} label="Egresos"  active={dir === 'out'} />
                </div>
              </div>
              <div>
                <span className="label-cap text-slate">Categoría</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {['rent', 'commission', 'other', 'deposit', 'utility', 'tax', 'refund'].map(c => (
                    <FilterPill key={c} href={buildHref({ category: c, page: undefined })} clearHref={buildHref({ category: 'todas' })} label={CATEGORY_LABEL[c]} active={category === c} />
                  ))}
                </div>
              </div>
            </div>
          </details>
          <Link href="/movimientos/nuevo" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-info text-white text-[13px] font-medium hover:brightness-110 transition-all shrink-0">
            <Plus size={16} /> Nuevo movimiento
          </Link>
        </div>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {kpis.map(k => (
          <div key={k.label} className="rounded-2xl border border-line bg-paper p-4 flex items-center gap-3 shadow-card">
            <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ backgroundColor: k.color + '26', color: k.color }}>
              <k.Icon size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] text-slate truncate">{k.label}</p>
              <p className="text-[20px] font-bold text-ink leading-tight tabular-nums">{k.value}</p>
              {k.d !== null && k.d !== undefined
                ? <p className="text-[11px] text-slate mt-0.5">vs. {prevName} <span className={k.d >= 0 ? 'text-success font-medium' : 'text-danger font-medium'}>{(k.d >= 0 ? '+' : '-') + Math.abs(k.d).toFixed(1).replace('.', ',')}%</span></p>
                : <p className="text-[11px] text-slate mt-0.5">{k.sub}</p>}
            </div>
          </div>
        ))}
      </section>

      {/* Table */}
      <section className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
        <div className="overflow-auto lg:flex-1 lg:min-h-0">
          {pageRows.length > 0 ? (
            <table className="w-full text-[13px] min-w-[900px]">
              <thead className="sticky top-0 z-10 bg-paper">
                <tr className="border-b border-line">
                  <th className="label-cap font-medium text-slate text-left  px-4 py-2.5 w-[70px]">Fecha</th>
                  <th className="label-cap font-medium text-slate text-left  px-4 py-2.5">Tipo</th>
                  <th className="label-cap font-medium text-slate text-left  px-4 py-2.5">Concepto / contrato</th>
                  <th className="label-cap font-medium text-slate text-center px-4 py-2.5 w-[90px]">Dirección</th>
                  <th className="label-cap font-medium text-slate text-right  px-4 py-2.5">Monto</th>
                  <th className="label-cap font-medium text-slate text-left  px-4 py-2.5 w-[120px]">Banco</th>
                  <th className="px-3 py-2.5 w-[36px]"></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(m => <MovRow key={m.id} m={m} />)}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-[14px] text-slate">No hay movimientos que coincidan con los filtros</div>
          )}
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-3 flex-wrap shrink-0">
            <p className="text-[12px] text-slate tabular-nums">Mostrando {fromN} a {toN} de {filtered.length} movimiento{filtered.length === 1 ? '' : 's'}</p>
            <TablePagination page={page} totalPages={totalPages} hrefFor={pageHref} />
          </div>
        )}
      </section>
    </div>
  )
}

function MovRow({ m }: { m: MovimientoRow }) {
  const isIn = m.direction === 'IN'
  return (
    <ClickableRow href={`/movimientos/${m.id}`} className="border-b border-line/60 last:border-0 hover:bg-cream-2 transition-colors">
      <td className="px-4 py-2.5 text-slate-dark tabular-nums whitespace-nowrap">{DATE_LABEL(m.bankDate)}</td>
      <td className="px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {isIn ? <ArrowUp size={15} className="text-success shrink-0" /> : <ArrowDown size={15} className="text-danger shrink-0" />}
          <span className="text-ink">{m.typeLabel}</span>
        </span>
      </td>
      <td className="px-4 py-2.5">
        {m.contractNumber ? (
          <span className="min-w-0">
            <span className="tabular-nums text-slate-dark">{m.contractNumber}</span>
            {m.counterparty && <span className="text-ink"> · {m.counterparty}</span>}
          </span>
        ) : (
          <span className="text-slate-dark">{m.description || '—'}</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center">
        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${isIn ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
          {isIn ? 'IN' : 'OUT'}
        </span>
      </td>
      <td className={`px-4 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap ${isIn ? 'text-success' : 'text-danger'}`}>{fmt(m.amount)}</td>
      <td className="px-4 py-2.5 text-slate-dark whitespace-nowrap">{m.bank ?? <span className="text-slate/40">—</span>}</td>
      <td className="px-3 py-2.5 text-right"><ChevronRight size={16} className="text-slate/50 inline" /></td>
    </ClickableRow>
  )
}
