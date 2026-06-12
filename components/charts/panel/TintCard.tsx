// ============================================================================
// TintCard — small premium stat card with a colored left border, a tinted
// background, an uppercase accent label, a big value, and an optional
// sublabel. Used across /dashboard panels to make the same accent color
// carry through (chart segment color = card accent color).
//
// Optionally a link target — wraps in <Link> when `href` is set.
// ============================================================================

import Link from 'next/link'
import type { ReactNode } from 'react'

interface TintCardProps {
  /** Accent hex color (e.g. "#D4A857"). Drives left border + label + bg tint. */
  accent:     string
  label:      string
  value:      ReactNode
  sublabel?:  ReactNode
  href?:      string
  /** Slightly different opacity scale for bg tint when there's no data. */
  muted?:     boolean
}

/** "#D4A857" + 0.10  →  "rgba(212, 168, 87, 0.10)". */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function TintCard({ accent, label, value, sublabel, href, muted = false }: TintCardProps) {
  const bgAlpha = muted ? 0.04 : 0.10
  const inner = (
    <div
      className="px-2.5 py-2 rounded-md border-l-[3px] transition-all hover:opacity-80"
      style={{ borderLeftColor: accent, backgroundColor: hexToRgba(accent, bgAlpha) }}
    >
      <p
        className="text-[9px] uppercase tracking-wider font-semibold mb-1"
        style={{ color: accent }}
      >
        {label}
      </p>
      <p className="font-display text-[17px] font-medium tabular-nums leading-none text-ink">
        {value}
      </p>
      {sublabel && (
        <p className="text-[10px] text-slate mt-1 truncate">{sublabel}</p>
      )}
    </div>
  )

  return href ? <Link href={href} className="block">{inner}</Link> : inner
}
