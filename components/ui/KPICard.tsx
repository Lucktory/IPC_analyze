import Link from 'next/link'

type Tone = 'positive' | 'negative' | 'neutral'

interface KPICardProps {
  label:      string
  value:      string
  delta?:     string
  deltaTone?: Tone
  href?:      string   // When set, the card becomes a clickable filter chip
  clearHref?: string   // When set and `active` is true, click goes here (toggle off)
  active?:    boolean
}

const toneClass: Record<Tone, string> = {
  positive: 'text-success',
  negative: 'text-danger',
  neutral:  'text-slate-dark',
}

/**
 * Compact KPI card — sits inside the sticky strip that lives directly under
 * the title bar. Layout: tiny uppercase label on top, value below, optional
 * delta below that. Card height is ~64–72px so two strips stacked don't eat
 * the whole viewport on a phone.
 */
export function KPICard({ label, value, delta, deltaTone = 'neutral', href, clearHref, active }: KPICardProps) {
  const target = active && clearHref ? clearHref : href

  const baseClass = [
    'relative bg-paper border rounded p-2.5 shadow-card transition-colors duration-150',
    active
      ? 'border-ink ring-1 ring-success/30'
      : target
        ? 'border-line hover:border-ink/40 hover:bg-cream-2/30 cursor-pointer'
        : 'border-line',
  ].join(' ')

  const content = (
    <>
      {active && (
        <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-success/15">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-success">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      )}
      <p className="label-cap pr-4 truncate">{label}</p>
      <p className="font-display text-[18px] sm:text-[20px] leading-none font-semibold text-ink mt-1 tabular-nums tracking-tight truncate">
        {value}
      </p>
      {delta && (
        <p className={`text-[10px] mt-1 font-medium truncate ${toneClass[deltaTone]}`}>{delta}</p>
      )}
    </>
  )

  if (target) {
    return (
      <Link
        href={target}
        title={active && clearHref ? 'Tocá para quitar este filtro' : undefined}
        className={`block ${baseClass}`}
      >
        {content}
      </Link>
    )
  }
  return <div className={baseClass}>{content}</div>
}
