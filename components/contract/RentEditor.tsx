'use client'

// ============================================================================
// RentEditor — click-to-edit CORRECTION of the contract's rent, on the
// contract detail page. Same thin-wrapper shape as CommissionPctEditor: the
// InlineNumberCell is a client component and needs the contractId closure,
// which a server component can't build across the RSC boundary.
//
// This edits contracts.current_rent — the STORED value shown in this card —
// not the "Alquiler vigente" KPI at the top of the page, which renders the
// LIVE rent (the stored value compounded forward by any scheduled increases
// not yet applied). Binding an editor to that KPI would let the user type one
// figure and have a different one stored, then re-compounded.
//
// It is a correction, not an increase: correctContractRent writes the amount
// and nothing else — no `adjustments` row, no change to last_adjustment_date
// or next_adjustment_date. Use AplicarAumentoControl for an actual aumento.
// ============================================================================

import { InlineNumberCell } from '@/components/liquidacion/InlineNumberCell'
import { correctContractRent } from '@/lib/contract/inline-field-actions'

export function RentEditor({ contractId, rent }: { contractId: string; rent: number }) {
  return (
    <InlineNumberCell
      value={rent}
      format="money"
      min={0}
      unit="$"
      title="Click para corregir el alquiler cargado — corrige el monto, no aplica un aumento ni mueve el calendario de ajustes"
      displayClassName="text-ink font-medium"
      onSave={(v) => correctContractRent(contractId, v)}
    />
  )
}
