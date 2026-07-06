import Link from 'next/link'
import type { ComponentType } from 'react'

// Shared KPI stat card — the Diagnostico look: a rounded card with a colored
// left accent, a filled colored icon square (white glyph) on the left, and the
// label / big number / sub stacked to its right. Optionally a clickable filter
// (href) with an active ring. Used across the entity list pages so every KPI
// row reads as one system.
export function StatCard({ Icon, color, label, value, sub, href, active }: {
  Icon:    ComponentType<{ size?: number }>
  color:   string
  label:   string
  value:   string
  sub?:    string
  href?:   string
  active?: boolean
}) {
  const inner = (
    <>
      <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 text-white" style={{ backgroundColor: color }}>
        <Icon size={19} />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] text-slate-dark leading-tight truncate">{label}</p>
        <p className="text-[22px] font-bold text-ink leading-none tabular-nums truncate mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-slate mt-1 truncate">{sub}</p>}
      </div>
    </>
  )
  const cls = `rounded-2xl border border-line border-l-[5px] bg-paper p-4 flex items-center gap-3 shadow-card transition-colors ${
    active ? 'ring-1 ring-info/40' : href ? 'hover:border-info/40' : ''
  }`
  return href
    ? <Link href={href} className={cls} style={{ borderLeftColor: color }}>{inner}</Link>
    : <div className={cls} style={{ borderLeftColor: color }}>{inner}</div>
}
