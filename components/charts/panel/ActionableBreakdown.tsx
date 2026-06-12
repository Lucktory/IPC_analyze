// ============================================================================
// ActionableBreakdown — Panel 2 of /dashboard. Answers "what do I need to
// do this week?" in one glance:
//
//   • Total pendientes count as the headline number, color-coded by load
//   • One row per category (cobranza / aumento / renovación) with:
//       - colored severity dot
//       - category label + short description
//       - horizontal proportion bar
//       - count + clickable → opens /pendientes filtered by category
//   • Empty state is celebratory ("Sin pendientes por ahora") so a clean
//     panel reads as success, not "broken".
// ============================================================================

import Link from 'next/link'
import type { PendingCounts } from '@/lib/pending/queries'

interface CategorySpec {
  key:        keyof Omit<PendingCounts, 'total'>
  href:       string
  label:      string
  hint:       string
  /** Tailwind utility for the dot. Severity ranking: danger > warn > info. */
  dot:        string
  /** Bar fill — references CSS-var-based theme colors. */
  fillCssVar: string
}

const CATEGORIES: CategorySpec[] = [
  {
    key:   'cobranza',
    href:  '/pendientes?tipo=cobranza',
    label: 'Cobranza vencida',
    hint:  'Inquilinos con pago atrasado del período',
    dot:        'bg-danger',
    fillCssVar: 'rgb(var(--color-danger))',
  },
  {
    key:   'aumento',
    href:  '/pendientes?tipo=aumento',
    label: 'Aviso de aumento',
    hint:  'Próximo aumento en ≤30 días — enviar email',
    dot:        'bg-warn',
    fillCssVar: 'rgb(var(--color-warn))',
  },
  {
    key:   'renovacion',
    href:  '/pendientes?tipo=renovacion',
    label: 'Renovación / vencimiento',
    hint:  'Contratos por vencer en ≤30 días',
    dot:        'bg-info',
    fillCssVar: 'rgb(var(--color-info))',
  },
]

interface Props {
  counts: PendingCounts
}

export function ActionableBreakdown({ counts }: Props) {
  const max = Math.max(1, ...CATEGORIES.map(c => counts[c.key]))

  // Color for the headline number based on load
  const headlineColor =
    counts.total === 0    ? 'text-success' :
    counts.cobranza > 0   ? 'text-danger'  :   // any vencidas → red headline
    counts.total >  5     ? 'text-warn'    :
                            'text-ink'

  return (
    <div className="flex flex-col gap-5">
      {/* Headline */}
      <div className="flex items-baseline gap-3">
        <p className={`font-display text-[34px] font-medium tabular-nums leading-none ${headlineColor}`}>
          {counts.total}
        </p>
        <p className="text-[13px] text-slate-dark">
          {counts.total === 0   ? 'sin pendientes por ahora' :
           counts.total === 1   ? 'acción pendiente'         :
                                  'acciones pendientes'}
        </p>
      </div>

      {counts.total === 0 ? (
        <p className="text-[12px] text-slate py-4">
          Todo al día — volvé mañana o revisá <Link href="/pendientes" className="text-ink hover:underline">la cola completa</Link>.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {CATEGORIES.map(cat => {
            const n   = counts[cat.key]
            const pct = (n / max) * 100
            const empty = n === 0
            return (
              <li key={cat.key}>
                <Link
                  href={cat.href}
                  className={`grid grid-cols-[16px_minmax(0,1fr)_minmax(80px,140px)_56px] gap-3 items-center px-2 -mx-2 py-2 rounded hover:bg-cream-2 transition-colors group ${empty ? 'opacity-50' : ''}`}
                  aria-label={`${cat.label}: ${n}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink font-medium leading-tight truncate">{cat.label}</p>
                    <p className="text-[11px] text-slate leading-tight truncate mt-0.5">{cat.hint}</p>
                  </div>
                  <div className="h-2 rounded-full bg-cream-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: cat.fillCssVar }}
                    />
                  </div>
                  <div className="flex items-baseline gap-1 justify-end">
                    <span className="text-[15px] font-medium text-ink tabular-nums">{n}</span>
                    <span className="text-[11px] text-slate opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
