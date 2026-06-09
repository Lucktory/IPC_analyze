import Link from 'next/link'

type Tone = 'positive' | 'negative' | 'neutral'

interface KPICardProps {
  label:     string
  value:     string
  delta?:    string
  deltaTone?: Tone
  href?:     string   // When set, the card becomes a clickable filter chip
  active?:   boolean  // When true, the card renders with the active-filter styling
}

const toneClass: Record<Tone, string> = {
  positive: 'text-success',
  negative: 'text-danger',
  neutral:  'text-slate-dark',
}

export function KPICard({ label, value, delta, deltaTone = 'neutral', href, active }: KPICardProps) {
  const baseClass = [
    'bg-paper border rounded p-5 shadow-card transition-all duration-200',
    active
      ? 'border-ink ring-1 ring-ink/15'
      : href
        ? 'border-line hover:border-ink/40 hover:-translate-y-0.5 hover:shadow-cardHover cursor-pointer'
        : 'border-line hover:border-ink/25 hover:-translate-y-0.5 hover:shadow-cardHover',
  ].join(' ')

  const content = (
    <>
      <p className="label-cap">{label}</p>
      <p className="font-display text-[32px] leading-none font-semibold text-ink mt-3 tabular-nums tracking-tight">
        {value}
      </p>
      {delta && (
        <p className={`text-[12px] mt-3 font-medium ${toneClass[deltaTone]}`}>{delta}</p>
      )}
    </>
  )

  if (href) {
    return <Link href={href} className={`block ${baseClass}`}>{content}</Link>
  }
  return <div className={baseClass}>{content}</div>
}
