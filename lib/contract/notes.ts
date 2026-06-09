// ============================================================================
// Per-contract per-period notes — Alejandro's DEUDA Y/U OBSERVACIONES analog.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'

export interface PeriodNote {
  body:      string
  updatedAt: string | null
  updatedBy: string | null
}

export async function getNoteForPeriod(
  contractId: string,
  period:     string,
): Promise<PeriodNote> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('contract_period_notes')
    .select('body, updated_at, updated_by')
    .eq('contract_id', contractId)
    .eq('period', period)
    .maybeSingle()

  return {
    body:      (data as any)?.body ?? '',
    updatedAt: (data as any)?.updated_at ?? null,
    updatedBy: (data as any)?.updated_by ?? null,
  }
}
