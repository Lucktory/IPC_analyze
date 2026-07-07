'use client'

// ============================================================================
// CommissionPctEditor — click-to-edit commission % on the contract detail
// page. Thin client wrapper so the InlineNumberCell (client) can bind the
// server action with the contractId closure (a server component can't create
// that closure and pass it across the RSC boundary).
// ============================================================================

import { InlineNumberCell } from '@/components/liquidacion/InlineNumberCell'
import { updateContractCommissionPct } from '@/lib/contract/inline-field-actions'

export function CommissionPctEditor({ contractId, pct }: { contractId: string; pct: number }) {
  return (
    <InlineNumberCell
      value={pct}
      format="percent"
      min={0}
      max={100}
      unit="%"
      title="Click para editar la comisión"
      displayClassName="text-ink font-medium"
      onSave={(v) => updateContractCommissionPct(contractId, v)}
    />
  )
}
