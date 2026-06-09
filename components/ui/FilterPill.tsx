import Link from 'next/link'

interface FilterPillProps {
  href:       string                 // URL used when the pill is NOT active
  label:      string
  count?:     number | null
  active:     boolean
  clearHref?: string                 // When provided, an active pill links here (toggle off)
}

export function FilterPill({ href, label, count, active, clearHref }: FilterPillProps) {
  const target = active && clearHref ? clearHref : href
  return (
    <Link
      href={target}
      title={active && clearHref ? 'Tocá para quitar este filtro' : undefined}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors',
        active
          ? 'bg-cream-2 text-ink border-ink/40 ring-1 ring-success/30 hover:bg-cream'
          : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
      ].join(' ')}
    >
      {active && <CheckIcon />}
      <span>{label}</span>
      {typeof count === 'number' && (
        <span
          className={[
            'inline-flex items-center justify-center text-[10px] font-medium tabular-nums px-1.5 rounded',
            active ? 'bg-success/15 text-success' : 'bg-line/60 text-slate-dark',
          ].join(' ')}
        >
          {count}
        </span>
      )}
    </Link>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-success shrink-0">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
