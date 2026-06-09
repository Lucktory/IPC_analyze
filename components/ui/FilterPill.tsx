import Link from 'next/link'

interface FilterPillProps {
  href:   string
  label:  string
  count?: number | null
  active: boolean
}

export function FilterPill({ href, label, count, active }: FilterPillProps) {
  return (
    <Link
      href={href}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors',
        active
          ? 'bg-ink text-paper border-ink'
          : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
      ].join(' ')}
    >
      <span>{label}</span>
      {typeof count === 'number' && (
        <span
          className={[
            'inline-flex items-center justify-center text-[10px] font-medium tabular-nums px-1.5 rounded',
            active ? 'bg-paper/15 text-paper' : 'bg-line/60 text-slate-dark',
          ].join(' ')}
        >
          {count}
        </span>
      )}
    </Link>
  )
}
