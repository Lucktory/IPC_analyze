import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { FilterPill } from '@/components/ui/FilterPill'
import Link from 'next/link'
import { listTransactions, listTransactionPeriods, type TransactionRow } from '@/lib/entities/queries'

const PAGE_SIZE = 50

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

type Dir = 'todos' | 'in' | 'out'

const CATEGORY_LABEL: Record<string, string> = {
  rent:       'Alquiler',
  commission: 'Comisión',
  expense:    'Gastos',
  tax:        'Impuestos',
  utility:    'Servicios',
  deposit:    'Depósito',
  refund:     'Reintegros',
  transfer:   'Transferencias',
  other:      'Otros',
}
const CATEGORIES = Object.keys(CATEGORY_LABEL)

interface PageProps {
  searchParams: Promise<{
    period?:   string
    dir?:      string
    category?: string
    q?:        string
    page?:     string
  }>
}

export default async function MovimientosPage({ searchParams }: PageProps) {
  const sp       = await searchParams
  const period   = sp.period
  const dir      = (sp.dir as Dir) ?? 'todos'
  const category = sp.category ?? 'todas'
  const q        = sp.q?.trim() ?? ''
  const pageNum  = Math.max(1, Number(sp.page) || 1)

  const [periods, all] = await Promise.all([
    listTransactionPeriods(),
    listTransactions(period),
  ])

  const match = (t: TransactionRow, d: Dir) => {
    if (d === 'in')  return t.direction === 'IN'
    if (d === 'out') return t.direction === 'OUT'
    return true
  }

  const counts = {
    todos: all.length,
    in:    all.filter(t => match(t, 'in')).length,
    out:   all.filter(t => match(t, 'out')).length,
  }

  let filtered = all.filter(t => match(t, dir))
  if (category !== 'todas') filtered = filtered.filter(t => t.category === category)
  if (q) {
    const ql = q.toLowerCase()
    filtered = filtered.filter(t =>
      (t.tenantName?.toLowerCase().includes(ql) ?? false) ||
      (t.description?.toLowerCase().includes(ql) ?? false) ||
      t.typeLabel.toLowerCase().includes(ql),
    )
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page       = Math.min(pageNum, totalPages)
  const start      = (page - 1) * PAGE_SIZE
  const slice      = filtered.slice(start, start + PAGE_SIZE)

  const inTotal  = filtered.filter(t => t.direction === 'IN').reduce((s, t) => s + t.amount, 0)
  const outTotal = filtered.filter(t => t.direction === 'OUT').reduce((s, t) => s + t.amount, 0)

  const kpis = [
    { label: 'Movimientos',  value: filtered.length.toString(),                       delta: filtered.length === all.length ? 'sin filtros' : `de ${all.length} totales`, tone: 'neutral'  as const },
    { label: 'Ingresos',     value: '$' + (inTotal / 1_000_000).toFixed(2) + ' M',    delta: 'cobros del rango filtrado',   tone: 'positive' as const },
    { label: 'Egresos',      value: '$' + (outTotal / 1_000_000).toFixed(2) + ' M',   delta: 'comisión + gastos',          tone: 'negative' as const },
    { label: 'Neto',         value: '$' + ((inTotal - outTotal) / 1_000_000).toFixed(2) + ' M', delta: 'a transferir',  tone: 'neutral'   as const },
  ]

  const buildHref = (overrides: Partial<{ period: string; dir: Dir; category: string; q: string; page: number }>) => {
    const params = new URLSearchParams()
    const merged = { period, dir, category, q, page, ...overrides }
    if (merged.period)                                  params.set('period',   merged.period)
    if (merged.dir      && merged.dir      !== 'todos') params.set('dir',      merged.dir)
    if (merged.category && merged.category !== 'todas') params.set('category', merged.category)
    if (merged.q)                                       params.set('q',        merged.q)
    if (merged.page     && merged.page     > 1)         params.set('page',     String(merged.page))
    const qs = params.toString()
    return qs ? `/movimientos?${qs}` : '/movimientos'
  }

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <p className="text-[13px] text-slate-dark">
            <strong className="text-ink font-medium">Movimientos</strong> ·{' '}
            {period ? PERIOD_LABEL(period) : 'todos los períodos'}
            {filtered.length !== all.length && ` · ${filtered.length} filtrados`}
          </p>
          <p className="label-cap text-slate">Datos en vivo</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
          ))}
        </div>
      </StickyHeader>

      {/* FILTER STRIP */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card p-4 sm:p-5">
        {/* Row 1: direction pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="label-cap text-slate mr-1">Dirección</span>
          <FilterPill href={buildHref({ dir: 'todos', page: 1 })} label="Todos"     count={counts.todos} active={dir === 'todos'} />
          <FilterPill href={buildHref({ dir: 'in',    page: 1 })} label="Ingresos"  count={counts.in}    active={dir === 'in'} />
          <FilterPill href={buildHref({ dir: 'out',   page: 1 })} label="Egresos"   count={counts.out}   active={dir === 'out'} />
        </div>

        {/* Row 2: search + category + period */}
        <form className="mt-4 flex flex-wrap items-end gap-3" method="get">
          {dir      && dir      !== 'todos' && <input type="hidden" name="dir"      value={dir} />}
          {period                            && <input type="hidden" name="period"   value={period} />}

          <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <span className="label-cap">Búsqueda</span>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Buscar por inquilino, descripción, tipo…"
              className="h-9 px-3 rounded border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label-cap">Categoría</span>
            <select
              name="category"
              defaultValue={category}
              className="h-9 px-3 rounded border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors"
            >
              <option value="todas">Todas</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </label>

          <button
            type="submit"
            className="h-9 px-4 bg-ink text-paper rounded text-[12px] font-medium hover:opacity-90 transition-opacity"
          >
            Filtrar
          </button>

          {(q || category !== 'todas') && (
            <Link
              href={buildHref({ q: '', category: 'todas', page: 1 })}
              className="h-9 inline-flex items-center px-3 text-[12px] text-slate hover:text-ink transition-colors"
            >
              Limpiar
            </Link>
          )}
        </form>

        {/* Row 3: period pills */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="label-cap text-slate mr-1">Período</span>
          <PeriodPill label="Todos" href={buildHref({ period: undefined, page: 1 })} active={!period} />
          {periods.map(p => (
            <PeriodPill key={p} label={PERIOD_LABEL(p)} href={buildHref({ period: p, page: 1 })} active={period === p} />
          ))}
        </div>
      </section>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">Detalle</h2>
            <p className="text-[12px] text-slate mt-0.5">
              Ordenados por fecha bancaria descendente · {PAGE_SIZE} por página
            </p>
          </div>
          <p className="text-[12px] text-slate tabular-nums">
            {filtered.length === 0
              ? 'sin resultados'
              : `${start + 1}–${start + slice.length} de ${filtered.length}`}
          </p>
        </div>
        <div className="overflow-x-auto">
          {slice.length > 0 ? (
            <table className="w-full text-[13px] min-w-[920px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Fecha</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Período</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Tipo</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium border-r border-line/50">Inquilino</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Monto</th>
                  <th className="text-left  px-4 py-1.5 label-cap font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((t, idx) => <TxRow key={t.id} t={t} odd={idx % 2 === 0} />)}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[14px] text-slate">No hay movimientos que coincidan con los filtros</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-line flex items-center justify-between text-[12px]">
            <p className="text-slate">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <PageLink href={buildHref({ page: page - 1 })} disabled={page <= 1} label="← Anterior" />
              <PageLink href={buildHref({ page: page + 1 })} disabled={page >= totalPages} label="Siguiente →" />
            </div>
          </div>
        )}
      </section>
    </>
  )
}

function TxRow({ t, odd }: { t: TransactionRow; odd: boolean }) {
  return (
    <tr className={`${odd ? 'bg-cream/40' : ''} hover:bg-cream-2 transition-colors border-b border-line/30`}>
      <td className="px-4 py-1.5 text-slate-dark tabular-nums border-r border-line/30">{DATE_LABEL(t.bankDate)}</td>
      <td className="px-4 py-1.5 text-slate-dark border-r border-line/30">{PERIOD_LABEL(t.period)}</td>
      <td className="px-4 py-1.5 border-r border-line/30">
        <Badge tone={t.direction === 'IN' ? 'success' : 'neutral'}>{t.typeLabel}</Badge>
      </td>
      <td className="px-4 py-1.5 text-ink border-r border-line/30">{t.tenantName ?? <span className="text-slate/50">—</span>}</td>
      <td className={`px-4 py-1.5 text-right tabular-nums font-medium border-r border-line/30 ${t.direction === 'IN' ? 'text-ink' : 'text-slate-dark'}`}>
        {t.direction === 'IN' ? '+ ' : '− '}{fmt(t.amount)}
      </td>
      <td className="px-4 py-1.5 text-slate text-[12px] truncate max-w-[280px]">
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

function PageLink({ href, label, disabled }: { href: string; label: string; disabled: boolean }) {
  if (disabled) {
    return (
      <span className="px-3 py-1 rounded border border-line/40 text-slate/40 cursor-not-allowed">{label}</span>
    )
  }
  return (
    <Link href={href} className="px-3 py-1 rounded border border-line text-slate-dark hover:bg-cream-2 hover:border-slate/30 transition-colors">
      {label}
    </Link>
  )
}
