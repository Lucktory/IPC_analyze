// ============================================================================
// /diagnostico — system-wide view of every validation issue across the
// active contracts for the current period.
//
// Complements the per-row Check badge on /liquidacion by giving a single
// list view sorted by severity (errors first) with per-rule filter chips.
// Same digest pattern as /pendientes; reuses StickyHeader + KPICard for
// visual consistency with /propietarios.
// ============================================================================

import Link from 'next/link'
import { getCurrentPeriod, getCurrentPeriodLabel } from '@/lib/period'
import { getDiagnosticoDigest, type DiagnosticoItem } from '@/lib/liquidacion/diagnostico'
import { StickyHeader } from '@/components/ui/StickyHeader'
import { StickyKPIStrip, StickyKPIStripItem } from '@/components/ui/StickyKPIStrip'
import { KPICard } from '@/components/ui/KPICard'
import { ValidationIssueRow, prettyValidationCode } from '@/components/shared/ValidationIssueRow'
import type { ValidationCode } from '@/lib/liquidacion/validations'

export const dynamic    = 'force-dynamic'
export const fetchCache = 'force-no-store'

type SeverityFilter = 'all' | 'error' | 'warning'

interface PageProps {
  searchParams: Promise<{ severidad?: string; regla?: string }>
}

function isSeverity(s: string | undefined): s is 'error' | 'warning' {
  return s === 'error' || s === 'warning'
}

export default async function DiagnosticoPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const severityFilter: SeverityFilter = isSeverity(sp.severidad) ? sp.severidad : 'all'
  const codeFilter: ValidationCode | null = (sp.regla as ValidationCode) || null

  const period      = getCurrentPeriod()
  const periodLabel = getCurrentPeriodLabel()

  let digest: Awaited<ReturnType<typeof getDiagnosticoDigest>> | null = null
  let runtimeError: string | null = null
  try {
    digest = await getDiagnosticoDigest(period)
  } catch (err) {
    console.error('[/diagnostico] getDiagnosticoDigest threw:', err)
    runtimeError = err instanceof Error ? err.message : String(err)
  }

  const items = digest?.items ?? []
  const counts = digest?.counts ?? { errors: 0, warnings: 0, totalIssues: 0, cleanContracts: 0, totalContracts: 0 }
  const byCode = digest?.byCode ?? {}

  const filtered = items.filter(i => {
    if (severityFilter !== 'all' && i.issue.severity !== severityFilter) return false
    if (codeFilter && i.issue.code !== codeFilter) return false
    return true
  })

  const grouped: Record<'error' | 'warning', DiagnosticoItem[]> = { error: [], warning: [] }
  for (const it of filtered) grouped[it.issue.severity].push(it)

  function linkWith(overrides: Partial<{ severidad: SeverityFilter; regla: ValidationCode | null }>) {
    const merged: { severidad: SeverityFilter; regla: ValidationCode | null } = {
      severidad: severityFilter,
      regla:     codeFilter,
      ...overrides,
    }
    const qs = new URLSearchParams()
    if (merged.severidad && merged.severidad !== 'all') qs.set('severidad', merged.severidad)
    if (merged.regla)                                    qs.set('regla',     merged.regla)
    return qs.size > 0 ? `/diagnostico?${qs.toString()}` : '/diagnostico'
  }

  // Per-rule chip list — sorted by count desc so the most pressing rules
  // surface first. Only rules with at least one occurrence are shown.
  const codeChips = (Object.entries(byCode) as [ValidationCode, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <>
      <StickyHeader>
        <div className="flex items-baseline justify-between gap-3 flex-wrap sm:flex-nowrap mb-2">
          <p className="text-[13px] text-slate-dark min-w-0 truncate flex-1 sm:flex-initial">
            <strong className="text-ink font-medium">Diagnóstico</strong>
            {' · '}
            {filtered.length === counts.totalIssues
              ? `${counts.totalIssues} ${counts.totalIssues === 1 ? 'issue' : 'issues'} · ${periodLabel}`
              : `${filtered.length} de ${counts.totalIssues} · ${periodLabel}`}
          </p>
        </div>

        <StickyKPIStrip cols={3}>
          <StickyKPIStripItem>
            <KPICard
              label="Errores"
              value={counts.errors.toString()}
              delta="acción requerida"
              deltaTone={counts.errors > 0 ? 'negative' : 'positive'}
              href={linkWith({ severidad: 'error', regla: null })}
              clearHref={linkWith({ severidad: 'all', regla: null })}
              active={severityFilter === 'error'}
            />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard
              label="Advertencias"
              value={counts.warnings.toString()}
              delta="revisar cuando puedas"
              deltaTone={counts.warnings > 0 ? 'negative' : 'neutral'}
              href={linkWith({ severidad: 'warning', regla: null })}
              clearHref={linkWith({ severidad: 'all', regla: null })}
              active={severityFilter === 'warning'}
            />
          </StickyKPIStripItem>
          <StickyKPIStripItem>
            <KPICard
              label="Contratos limpios"
              value={`${counts.cleanContracts} / ${counts.totalContracts}`}
              delta={counts.cleanContracts === counts.totalContracts ? '✓ todo en orden' : 'sin issues'}
              deltaTone="positive"
            />
          </StickyKPIStripItem>
        </StickyKPIStrip>
      </StickyHeader>

      {/* Per-rule filter chips */}
      {codeChips.length > 0 && (
        <div className="mt-4 bg-paper border border-line rounded shadow-card p-3">
          <div className="flex items-center gap-x-2 gap-y-1.5 flex-wrap">
            <span className="label-cap text-slate shrink-0">Regla</span>
            <Link
              href={linkWith({ regla: null })}
              className={[
                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-colors shrink-0',
                !codeFilter
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
              ].join(' ')}
            >
              Todas
            </Link>
            {codeChips.map(([code, n]) => {
              const active = codeFilter === code
              return (
                <Link
                  key={code}
                  href={linkWith({ regla: active ? null : code })}
                  className={[
                    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-colors shrink-0',
                    active
                      ? 'bg-ink text-paper border-ink'
                      : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
                  ].join(' ')}
                  title={code}
                >
                  <span>{prettyValidationCode(code)}</span>
                  <span className={`inline-flex items-center justify-center text-[9px] font-medium tabular-nums px-1 rounded ${active ? 'bg-paper/15 text-paper' : 'bg-line/60 text-slate-dark'}`}>
                    {n}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-4 pb-8">
        {runtimeError && (
          <div className="bg-danger/10 border border-danger/40 rounded p-3 text-[12px] text-ink">
            <p className="font-medium text-danger">⚠ No se pudo calcular el listado de diagnóstico.</p>
            <p className="text-slate-dark mt-1">{runtimeError}</p>
          </div>
        )}

        {(['error', 'warning'] as const).map(sev => {
          const list = grouped[sev]
          if (list.length === 0) return null
          const meta = sev === 'error'
            ? { label: 'Errores',       sub: 'Acción requerida para cerrar el ciclo de liquidación', dot: 'bg-danger', banner: 'bg-danger/10 border-danger/30 text-ink' }
            : { label: 'Advertencias', sub: 'Revisar cuando puedas — el flujo sigue funcionando',   dot: 'bg-warn',   banner: 'bg-warn/10 border-warn/30 text-ink' }
          return (
            <section key={sev} className="bg-paper border border-line rounded shadow-card overflow-hidden">
              <div className={`px-4 py-2.5 border-b border-line flex items-center justify-between ${meta.banner}`}>
                <div>
                  <h2 className="font-display text-[14px] font-medium flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} aria-hidden />
                    {meta.label}
                  </h2>
                  <p className="text-[11px] text-slate mt-0.5">{meta.sub}</p>
                </div>
                <span className="text-[11px] text-slate-dark tabular-nums">
                  {list.length} {list.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </div>
              <ul>
                {list.map(item => (
                  <ValidationIssueRow
                    key={`${item.contractId}-${item.issue.code}`}
                    issue={item.issue}
                    contract={{
                      contractId:   item.contractId,
                      tenantName:   item.tenantName,
                      landlordName: item.landlordName,
                    }}
                  />
                ))}
              </ul>
            </section>
          )
        })}

        {filtered.length === 0 && !runtimeError && (
          <div className="bg-paper border border-line rounded shadow-card p-10 text-center">
            <p className="text-[14px] text-slate">
              {counts.totalIssues === 0
                ? '✓ Todo en orden — no hay issues de validación en este período.'
                : 'Sin issues que coincidan con los filtros aplicados.'}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
