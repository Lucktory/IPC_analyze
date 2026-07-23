'use client'

// ============================================================================
// CommissionPctEditor — click-to-edit commission % on the contract detail
// page. Thin client wrapper so the InlineNumberCell (client) can bind the
// server action with the contractId closure (a server component can't create
// that closure and pass it across the RSC boundary).
// ============================================================================

import { InlineNumberCell } from '@/components/liquidacion/InlineNumberCell'
import { updateCommissionPctAndRecalc } from '@/lib/transaction/actions'

export function CommissionPctEditor({ contractId, pct, period }: { contractId: string; pct: number; period: string }) {
  return (
    <InlineNumberCell
      value={pct}
      format="percent"
      min={0}
      max={100}
      unit="%"
      title="Click para editar la comisión — recalcula la comisión del período"
      displayClassName="text-ink font-medium"
      onSave={(v) => updateCommissionPctAndRecalc(contractId, period, v)}
    />
  )
}
