// ============================================================================
// SumPill — green/red pill that displays the live sum of a "must-equal-100"
// section. Uses isPctSum100() from the function registry so the threshold
// matches the server-side guard exactly.
// ============================================================================

'use client'

import { isPctSum100 } from '@/lib/shared'

interface Props {
  /** Raw values to sum (numbers OR strings — the form keeps them as strings
   *  while the user types). */
  values: ReadonlyArray<number | string | null | undefined>
}

export function SumPill({ values }: Props) {
  const sum = values.reduce<number>((acc, v) => {
    const n = typeof v === 'string' ? Number(v) : (v ?? 0)
    return acc + (Number.isFinite(n) ? n : 0)
  }, 0)
  const ok = isPctSum100(values)

  return (
    <span
      className={`text-[11px] tabular-nums px-2 py-0.5 rounded ${
        ok
          ? 'bg-success/10 text-success'
          : 'bg-danger/10 text-danger'
      }`}
      title={ok ? 'Los porcentajes suman 100%' : 'Los porcentajes deben sumar exactamente 100%'}
    >
      Σ {sum.toFixed(2)}%
    </span>
  )
}
