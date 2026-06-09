import Link from 'next/link'

type Tone = 'positive' | 'negative' | 'neutral'

interface KPICardProps {
  label:     string
  value:     string
  delta?:    string
  deltaTone?: Tone
  href?:     string   // When set, the card becomes a clickable filter chip
  clearHref?: string  // When set and `active` is true, click goes here (toggle off)
  active?:   boolean  // When true, the card renders with the active-filter styling
}

const toneClass: Record<Tone, string> = {
  positive: 'text-success',
  negative: 'text-danger',
  neutral:  'text-slate-dark',
}

export function KPICard({ label, value, delta, deltaTone = 'neutral', href, clearHref, active }: KPICardProps) {
  const target = active && clearHref ? clearHref : href

  const baseClass = [
    'relative bg-paper border rounded p-5 shadow-card transition-all duration-200',
    active
      ? 'border-ink ring-1 ring-success/30'
      : target
        ? 'border-line hover:border-ink/40 hover:-translate-y-0.5 hover:shadow-cardHover cursor-pointer'
        : 'border-line',
  ].join(' ')

  const content = (
    <>
      {active && (
        <span className="absolute top-3 right-3 inline-flex items-center justify-center w-5 h-5 rounded-full bg-success/15">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      )}
      <p className="label-cap">{label}</p>
      <p className="font-display text-[32px] leading-none font-semibold text-ink mt-3 tabular-nums tracking-tight">
        {value}
      </p>
      {delta && (
        <p className={`text-[12px] mt-3 font-medium ${toneClass[deltaTone]}`}>{delta}</p>
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
