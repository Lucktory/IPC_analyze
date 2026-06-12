// ============================================================================
// DeltaIndicator — the "VS. MES ANTERIOR ↑14" pill used in card top-right
// slots. Up arrow + green when positive, down arrow + red when negative,
// dimmed when flat. Value is rendered tabular so the digits don't wiggle.
// ============================================================================

import { fmtMoney } from '@/lib/format'

interface DeltaIndicatorProps {
  label:  string
  delta:  number
  /** When true, format `delta` as currency. Otherwise as raw integer. */
  currency?: boolean
}

export function DeltaIndicator({ label, delta, currency }: DeltaIndicatorProps) {
  const sign  = delta > 0 ? '↑' : delta < 0 ? '↓' : '·'
  const color = delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-slate'
  const abs   = Math.abs(delta)
  const value = currency ? fmtMoney(abs) : abs.toLocaleString('es-AR')

  return (
    <div className="text-right">
      <p className="text-[10px] text-slate uppercase tracking-wider">{label}</p>
      <p className={`text-[15px] font-medium tabular-nums leading-tight mt-0.5 ${color}`}>
        {sign} {value}
      </p>
    </div>
  )
}
