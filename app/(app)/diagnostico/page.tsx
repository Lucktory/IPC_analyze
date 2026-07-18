// ============================================================================
// /diagnostico — system-wide view of every validation issue for the period,
// grouped into Errores / Advertencias, with per-rule filter chips, a free-text
// filter, and expandable sections (show a few, "ver más" for the rest).
// ============================================================================

import Link from 'next/link'
import { AlertCircle, AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react'
import { AutoSearchInput } from '@/components/ui/AutoSearchInput'
import { PeriodSelect } from '@/components/charts/panel/PeriodSelect'
import { getDiagnosticoDigest, type DiagnosticoItem } from '@/lib/liquidacion/diagnostico'
import { getDashboardPeriod, getPeriodsWithData } from '@/lib/dashboard/queries'
import { prettyValidationCode } from '@/components/shared/ValidationIssueRow'
import { buildPeriodTabs } from '@/lib/period'
import { fmtMoney } from '@/lib/format'
import type { ValidationCode } from '@/lib/liquidacion/validations'

export const dynamic    = 'force-dynamic'
export const fetchCache = 'force-no-store'

const CAP = 6

interface PageProps {
  searchParams: Promise<{ period?: string; regla?: string; q?: string }>
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return fmtMoney(v)
  return String(v)
}

export default async function DiagnosticoPage({ searchParams }: PageProps) {
  const sp    = await searchParams
  const regla = sp.regla ?? null
  const q     = (sp.q ?? '').trim().toLowerCase()

  const [latest, dataPeriods] = await Promise.all([getDashboardPeriod(), getPeriodsWithData()])
  const validReq = sp.period && /^\d{4}-\d{2}-01$/.test(sp.period) ? sp.period : null
  const period = validReq ?? latest
  const selectorPeriods = buildPeriodTabs(dataPeriods, period, 3)

  const digest = await getDiagnosticoDigest(period)
  const { items, counts, byCode } = digest

  // Preserve the active rule + search when switching month.
  const dgExtra = new URLSearchParams()
  if (regla)  dgExtra.set('regla', regla)
  if (sp.q)   dgExtra.set('q', sp.q)
  const dgExtraQuery = dgExtra.toString()

  // Filter — by rule chip + free-text (contract, names, rule, message)
  let filtered = items
  if (regla) filtered = filtered.filter(i => i.issue.code === regla)
  if (q) filtered = filtered.filter(i =>
    (i.contractNumber ?? '').toLowerCase().includes(q) ||
    (i.tenantName ?? '').toLowerCase().includes(q) ||
    (i.landlordName ?? '').toLowerCase().includes(q) ||
    prettyValidationCode(i.issue.code).toLowerCase().includes(q) ||
    i.issue.message.toLowerCase().includes(q))

  const errores      = filtered.filter(i => i.issue.severity === 'error')
  const advertencias = filtered.filter(i => i.issue.severity === 'warning')

  const codeChips = (Object.entries(byCode) as [ValidationCode, number][])
    .filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])

  const chipHref = (code: string) => {
    const p = new URLSearchParams()
    if (regla !== code) p.set('regla', code)
    if (q) p.set('q', q)
    const qs = p.toString()
    return qs ? `/diagnostico?${qs}` : '/diagnostico'
  }

  const kpis = [
    { Icon: AlertCircle,   color: '#EF4444', label: 'Errores',          value: String(counts.errors),                          sub: 'acción requerida' },
    { Icon: AlertTriangle, color: '#F59E0B', label: 'Advertencias',     value: String(counts.warnings),                        sub: 'revisar este período' },
    { Icon: ShieldCheck,   color: '#16A34A', label: 'Contratos limpios', value: `${counts.cleanContracts} / ${counts.totalContracts}`, sub: 'sin inconsistencias' },
  ]

  return (
    <div className="space-y-5 pb-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold text-ink tracking-tight">Diagnóstico</h1>
          <nav className="text-[12px] text-slate mt-1 flex items-center gap-1.5">
            <Link href="/dashboard" className="text-info hover:underline">Inicio</Link>
            <span className="text-slate/50">/</span>
            <span className="text-slate-dark">Diagnóstico</span>
          </nav>
        </div>
        <PeriodSelect current={period} periods={selectorPeriods} basePath="/diagnostico" extraQuery={dgExtraQuery} />
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-2xl border border-line border-l-[5px] bg-paper p-5 flex items-center gap-4 shadow-card" style={{ borderLeftColor: k.color }}>
            <span className="w-14 h-14 rounded-xl grid place-items-center shrink-0 text-white" style={{ backgroundColor: k.color }}>
              <k.Icon size={26} />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] text-slate-dark">{k.label}</p>
              <p className="text-[30px] font-bold text-ink leading-none tabular-nums mt-0.5">{k.value}</p>
              <p className="text-[12px] text-slate mt-1">{k.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Filter field + rule chips */}
      <div className="flex flex-col gap-3">
        <AutoSearchInput initialValue={sp.q ?? ''} placeholder="Filtrar por contrato, propietario, inquilino o regla…" />
        {codeChips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {codeChips.map(([code, n]) => {
              const active = regla === code
              return (
                <Link key={code} href={chipHref(code)} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-colors ${
                  active ? 'border-info text-info bg-info/5' : 'border-line text-slate-dark bg-paper hover:border-info/40'
                }`}>
                  {prettyValidationCode(code)}
                  <span className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] tabular-nums ${active ? 'bg-info text-white' : 'bg-cream-2 text-slate-dark'}`}>{n}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Errores */}
      <Section title="Errores" count={errores.length} dot="#EF4444" items={errores} />

      {/* Advertencias */}
      <Section title="Advertencias" count={advertencias.length} dot="#F59E0B" items={advertencias} />

      {filtered.length === 0 && (
        <div className="bg-paper border border-line rounded-2xl shadow-card p-10 text-center">
          <ShieldCheck size={36} className="text-success mx-auto" />
          <p className="text-[15px] font-medium text-ink mt-2">
            {counts.totalIssues === 0 ? 'Todo en orden — sin inconsistencias en este período.' : 'Ningún issue coincide con el filtro.'}
          </p>
        </div>
      )}
    </div>
  )
}

function Section({ title, count, dot, items }: { title: string; count: number; dot: string; items: DiagnosticoItem[] }) {
  if (items.length === 0) return null
  const head = items.slice(0, CAP)
  const rest = items.slice(CAP)
  return (
    <section className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-line flex items-center gap-2">
        <h2 className="font-display text-[16px] font-semibold text-ink">{title}</h2>
        <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full text-white text-[12px] font-semibold tabular-nums" style={{ backgroundColor: dot }}>{count}</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          {head.map((it, i) => <Row key={`${it.contractId}-${it.issue.code}-${i}`} it={it} dot={dot} />)}
          {rest.length > 0 && (
            <details className="group">
              <summary className="list-none cursor-pointer px-5 py-3 text-[13px] font-medium text-info hover:bg-cream-2 flex items-center gap-1.5 [&::-webkit-details-marker]:hidden border-t border-line">
                <ChevronRight size={15} className="transition-transform group-open:rotate-90" />
                Ver {rest.length} más
              </summary>
              {rest.map((it, i) => <Row key={`${it.contractId}-${it.issue.code}-rest-${i}`} it={it} dot={dot} />)}
            </details>
          )}
        </div>
      </div>
    </section>
  )
}

function Row({ it, dot }: { it: DiagnosticoItem; dot: string }) {
  const { issue } = it
  const ea: string[] = []
  if (issue.expected !== null && issue.expected !== undefined) ea.push(`Esperado: ${fmtVal(issue.expected)}`)
  if (issue.actual !== null && issue.actual !== undefined)     ea.push(`Actual: ${fmtVal(issue.actual)}`)
  return (
    <Link href={`/contratos/${it.contractId}`} className="grid grid-cols-[10px_170px_210px_1fr_240px_18px] items-center gap-3 px-5 py-3 border-b border-line/60 last:border-0 hover:bg-cream-2 transition-colors">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />
      <span className="text-[13px] font-medium text-ink truncate">{prettyValidationCode(issue.code)}</span>
      <span className="text-[13px] text-slate-dark truncate tabular-nums">{it.contractNumber ?? `#${it.contractId.slice(0, 8)}`} · {it.tenantName}</span>
      <span className="text-[13px] text-slate truncate">{issue.message}</span>
      <span className="text-[12px] text-slate text-right truncate tabular-nums">{ea.join(' · ')}</span>
      <ChevronRight size={16} className="text-slate/50" />
    </Link>
  )
}
