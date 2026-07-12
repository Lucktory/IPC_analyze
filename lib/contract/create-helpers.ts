// ============================================================================
// Shared contract-create helpers — single source of truth for the rules that
// used to diverge between the two create paths (full NewContractForm ->
// createContract, and the /liquidacion grid modal -> createContractFromGrid):
//   • the human contract number C-YYYY-NNNN
//   • the administration a contract belongs to (must follow the property)
//   • the commission % (0-100 guard + house default)
// Both create paths import these so the same input can't produce different rows.
// ============================================================================

import type { createSupabaseServer } from '@/lib/supabase/server'

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServer>>

/** House default commission when none is entered (matches the DB column default). */
export const DEFAULT_COMMISSION_PCT = 8

/**
 * Next human contract number for the start-date's year: C-YYYY-NNNN, zero-padded
 * so it sorts lexicographically. (Read-max/insert is not race-safe — acceptable
 * for the current single-operator use; a DB sequence would harden it later.)
 */
export async function nextContractNumber(supabase: SupabaseServer, startDate: string): Promise<string> {
  const year = startDate.slice(0, 4)
  const { data: last } = await supabase
    .from('contracts')
    .select('contract_number')
    .like('contract_number', `C-${year}-%`)
    .order('contract_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const raw = (last as any)?.contract_number as string | undefined
  const lastSeq = raw ? (parseInt(raw.slice(-4), 10) || 0) : 0
  return `C-${year}-${String(lastSeq + 1).padStart(4, '0')}`
}

/** The administration that owns a property — a contract must inherit it (not the
 *  first-administration fallback) so per-administration scoping stays correct. */
export async function administrationIdForProperty(
  supabase: SupabaseServer,
  propertyId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('properties').select('administration_id').eq('id', propertyId).maybeSingle()
  return (data as any)?.administration_id ?? null
}

export type CommissionPctResult =
  | { ok: true;  value: number }
  | { ok: false; error: string }

/** Validate + resolve a commission %: 0-100, falling back to the house default
 *  when nothing is entered. Both create paths use this so one entry point can't
 *  silently store 8% while the other stores the real figure. */
export function resolveCommissionPct(raw: number | string | null | undefined): CommissionPctResult {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: DEFAULT_COMMISSION_PCT }
  }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!isFinite(n) || n < 0 || n > 100) {
    return { ok: false, error: 'La comisión debe estar entre 0 y 100.' }
  }
  return { ok: true, value: n }
}
