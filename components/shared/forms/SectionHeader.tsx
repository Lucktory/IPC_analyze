// ============================================================================
// SectionHeader — title + optional right adornment, with a bottom rule.
// ============================================================================

import type { ReactNode } from 'react'

interface Props {
  label:           string
  rightAdornment?: ReactNode
}

export function SectionHeader({ label, rightAdornment }: Props) {
  return (
    <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
      <h3 className="font-display text-[13px] font-medium text-ink">{label}</h3>
      {rightAdornment}
    </div>
  )
}
