import Link from 'next/link'

// Server-friendly pagination footer (Link-based, no client JS). Matches the
// "Anterior · 1 2 3 … N · Siguiente" pattern used across the redesigned list
// pages. `hrefFor(n)` builds the page URL preserving current filters.
export function TablePagination({ page, totalPages, hrefFor }: {
  page: number
  totalPages: number
  hrefFor: (n: number) => string
}) {
  if (totalPages <= 1) return null

  const nums: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) nums.push(i)
  } else {
    nums.push(1)
    if (page > 3) nums.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) nums.push(i)
    if (page < totalPages - 2) nums.push('…')
    nums.push(totalPages)
  }

  const edge = (label: string, to: number, disabled: boolean) =>
    disabled
      ? <span className="px-3 h-8 grid place-items-center rounded-md text-[12px] text-slate/30">{label}</span>
      : <Link href={hrefFor(to)} className="px-3 h-8 grid place-items-center rounded-md text-[12px] text-slate-dark hover:bg-cream-2 transition-colors">{label}</Link>

  return (
    <div className="flex items-center gap-1">
      {edge('Anterior', page - 1, page <= 1)}
      {nums.map((n, i) => n === '…'
        ? <span key={`e${i}`} className="px-1.5 text-slate">…</span>
        : <Link key={n} href={hrefFor(n)} className={`min-w-8 h-8 px-2 grid place-items-center rounded-md text-[13px] tabular-nums transition-colors ${
            n === page ? 'bg-info text-white font-medium' : 'text-slate-dark hover:bg-cream-2'
          }`}>{n}</Link>)}
      {edge('Siguiente', page + 1, page >= totalPages)}
    </div>
  )
}
