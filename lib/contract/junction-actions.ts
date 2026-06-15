'use server'

// ============================================================================
// Junction mutations — keep the primary landlord / primary tenant in sync
// when the encargada edits a Propietario or Inquilino cell directly in the
// /liquidacion grid.
//
// Two flows per entity type:
//   1. "Link existing" — payload includes the entity id; we just rewrite the
//      junction so that id becomes the primary.
//   2. "Create new"    — payload includes a fresh name; we create the entity,
//      then rewrite the junction. Used when the encargada confirms the
//      new-name alert in the InlineEntityCell.
//
// The current scope is intentionally small: each call re-targets the PRIMARY
// row only (the one with the highest ownership_pct for landlords, or
// is_primary = true for tenants). Full co-ownership / co-tenant editing
// stays on the contract detail page for now.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure } from '@/lib/db-errors'

export interface JunctionResult {
  ok:    boolean
  error: string | null
}

// ── helpers ─────────────────────────────────────────────────────────────────

function clean(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

// ============================================================================
// LANDLORD — make `landlordId` (or the newly-created landlord with the given
// name) the primary owner on the contract. Removes the previous primary; if
// the contract had co-owners they are preserved as secondary at 0% until the
// encargada redistributes from the detail page.
// ============================================================================
export async function setContractPrimaryLandlord(
  contractId:  string,
  payload:     { kind: 'existing'; landlordId: string } | { kind: 'new'; name: string },
): Promise<JunctionResult> {
  const supabase = await createSupabaseServer()

  // Resolve administration_id from the contract — needed when creating a new
  // landlord (administration_id is NOT NULL on landlords).
  const { data: contract, error: contractErr } = await supabase
    .from('contracts')
    .select('administration_id')
    .eq('id', contractId)
    .maybeSingle()
  if (contractErr)   return dbFailure(contractErr)
  if (!contract)     return { ok: false, error: 'Contrato no encontrado.' }

  // ── Resolve the landlord id ────────────────────────────────────────────
  let landlordId: string
  if (payload.kind === 'existing') {
    landlordId = payload.landlordId
  } else {
    const name = clean(payload.name)
    if (!name) return { ok: false, error: 'El nombre del propietario no puede estar vacío.' }

    // Defensive de-dup: if a landlord with the same name already exists in
    // this administration, link it instead of creating a duplicate.
    const { data: existing } = await supabase
      .from('landlords')
      .select('id')
      .eq('administration_id', (contract as any).administration_id)
      .ilike('name', name)
      .maybeSingle()
    if (existing) {
      landlordId = (existing as any).id
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('landlords')
        .insert({ administration_id: (contract as any).administration_id, name })
        .select('id')
        .single()
      if (insErr) return dbFailure(insErr)
      landlordId = (inserted as any).id
    }
  }

  // ── Rewrite the contract_landlords junction ────────────────────────────
  // Strategy: delete the existing PRIMARY row (highest ownership_pct), then
  // insert the new primary at 100%. Co-owners (if any) remain untouched but
  // their ownership_pct may no longer sum to 100 — that's a known cleanup
  // we surface on the contract detail page.
  const { data: links } = await supabase
    .from('contract_landlords')
    .select('landlord_id, ownership_pct')
    .eq('contract_id', contractId)
    .order('ownership_pct', { ascending: false })
  const rows = (links ?? []) as { landlord_id: string; ownership_pct: number }[]

  // If the desired landlord is already the primary, no-op.
  if (rows.length > 0 && rows[0].landlord_id === landlordId) {
    return { ok: true, error: null }
  }

  // Remove the old primary (if any).
  if (rows.length > 0) {
    const { error: delErr } = await supabase
      .from('contract_landlords')
      .delete()
      .eq('contract_id', contractId)
      .eq('landlord_id', rows[0].landlord_id)
    if (delErr) return dbFailure(delErr)
  }

  // Upsert the new primary. If the landlord already had a secondary stake
  // in this contract, promote it; otherwise insert fresh.
  const existingShare = rows.find(r => r.landlord_id === landlordId)
  if (existingShare) {
    const { error: upErr } = await supabase
      .from('contract_landlords')
      .update({ ownership_pct: 100 })
      .eq('contract_id', contractId)
      .eq('landlord_id', landlordId)
    if (upErr) return dbFailure(upErr)
  } else {
    const { error: insJErr } = await supabase
      .from('contract_landlords')
      .insert({ contract_id: contractId, landlord_id: landlordId, ownership_pct: 100 })
    if (insJErr) return dbFailure(insJErr)
  }

  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${contractId}`)
  return { ok: true, error: null }
}

// ============================================================================
// TENANT — make `tenantId` (or the newly-created tenant with the given name)
// the primary on the contract. Same strategy as landlord: delete prior
// primary, insert new at is_primary=true.
// ============================================================================
export async function setContractPrimaryTenant(
  contractId:  string,
  payload:     { kind: 'existing'; tenantId: string } | { kind: 'new'; name: string },
): Promise<JunctionResult> {
  const supabase = await createSupabaseServer()

  const { data: contract, error: contractErr } = await supabase
    .from('contracts')
    .select('administration_id')
    .eq('id', contractId)
    .maybeSingle()
  if (contractErr) return dbFailure(contractErr)
  if (!contract)   return { ok: false, error: 'Contrato no encontrado.' }

  let tenantId: string
  if (payload.kind === 'existing') {
    tenantId = payload.tenantId
  } else {
    const name = clean(payload.name)
    if (!name) return { ok: false, error: 'El nombre del inquilino no puede estar vacío.' }

    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('administration_id', (contract as any).administration_id)
      .ilike('name', name)
      .maybeSingle()
    if (existing) {
      tenantId = (existing as any).id
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('tenants')
        .insert({ administration_id: (contract as any).administration_id, name })
        .select('id')
        .single()
      if (insErr) return dbFailure(insErr)
      tenantId = (inserted as any).id
    }
  }

  const { data: links } = await supabase
    .from('contract_tenants')
    .select('tenant_id, is_primary')
    .eq('contract_id', contractId)
  const rows = (links ?? []) as { tenant_id: string; is_primary: boolean }[]
  const currentPrimary = rows.find(r => r.is_primary)

  if (currentPrimary?.tenant_id === tenantId) {
    return { ok: true, error: null }
  }

  // Demote the current primary, if any.
  if (currentPrimary) {
    const { error: demoteErr } = await supabase
      .from('contract_tenants')
      .update({ is_primary: false })
      .eq('contract_id', contractId)
      .eq('tenant_id', currentPrimary.tenant_id)
    if (demoteErr) return dbFailure(demoteErr)
  }

  // Promote (or insert) the new primary.
  const alreadyLinked = rows.some(r => r.tenant_id === tenantId)
  if (alreadyLinked) {
    const { error: promErr } = await supabase
      .from('contract_tenants')
      .update({ is_primary: true })
      .eq('contract_id', contractId)
      .eq('tenant_id', tenantId)
    if (promErr) return dbFailure(promErr)
  } else {
    const { error: insJErr } = await supabase
      .from('contract_tenants')
      .insert({ contract_id: contractId, tenant_id: tenantId, is_primary: true })
    if (insJErr) return dbFailure(insJErr)
  }

  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${contractId}`)
  return { ok: true, error: null }
}
