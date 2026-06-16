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

// ============================================================================
// createContractFromGrid — quick-create flow triggered by the "+ Nuevo contrato"
// modal on /liquidacion. Differs from the full createContract in two ways:
//   1. Accepts existing landlord/tenant ids OR fresh names (and creates the
//      entity when given a name). Mirrors the autocomplete pattern in the grid.
//   2. Auto-creates a placeholder property if no address is provided. The
//      encargada can fix the address from the contract detail page later.
//   3. Returns the new id instead of redirecting — modal closes, grid refreshes.
// ============================================================================

export interface CreateFromGridResult {
  ok:    boolean
  error: string | null
  contractId?: string
}

export interface CreateFromGridInput {
  lfaCode:    string | null
  landlord:
    | { kind: 'existing'; id: string }
    | { kind: 'new'; name: string; dniOrCuit?: string | null; phone?: string | null; email?: string | null; notes?: string | null }
  tenant:
    | { kind: 'existing'; id: string }
    | { kind: 'new'; name: string; dni?: string | null; phone?: string | null; email?: string | null }
  address:    string | null
  currentRent:    number
  commissionPct:  number
  startDate:      string  // YYYY-MM-DD
  endDate:        string  // YYYY-MM-DD
  cadence:        string  // mensual / bimestral / trimestral / cuatrimestral / semestral / anual
}

const ALLOWED_CADENCES = ['mensual', 'bimestral', 'trimestral', 'cuatrimestral', 'semestral', 'anual']

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

export async function createContractFromGrid(input: CreateFromGridInput): Promise<CreateFromGridResult> {
  const supabase = await createSupabaseServer()

  // ── Validate basics ───────────────────────────────────────────────────
  if (!isFinite(input.currentRent) || input.currentRent <= 0) {
    return { ok: false, error: 'El alquiler debe ser mayor a 0.' }
  }
  if (!isFinite(input.commissionPct) || input.commissionPct < 0 || input.commissionPct > 100) {
    return { ok: false, error: 'La comisión debe estar entre 0 y 100.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) return { ok: false, error: 'Fecha de inicio inválida.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.endDate))   return { ok: false, error: 'Fecha de fin inválida.' }
  if (new Date(input.endDate) <= new Date(input.startDate)) {
    return { ok: false, error: 'La fecha de fin debe ser posterior al inicio.' }
  }
  if (!ALLOWED_CADENCES.includes(input.cadence)) {
    return { ok: false, error: 'Cadencia inválida.' }
  }

  // ── Resolve administration_id from the first administration. The seed
  //    only has one (Pampa). When we go multi-tenant, this becomes a
  //    session-derived value.
  const { data: admin, error: adminErr } = await supabase
    .from('administrations').select('id').limit(1).maybeSingle()
  if (adminErr) return dbFailure(adminErr)
  if (!admin)   return { ok: false, error: 'No hay administración configurada.' }
  const administration_id = (admin as any).id as string

  // ── Resolve / create landlord ─────────────────────────────────────────
  let landlordId: string
  if (input.landlord.kind === 'existing') {
    landlordId = input.landlord.id
  } else {
    const name = clean(input.landlord.name)
    if (!name) return { ok: false, error: 'Nombre del propietario vacío.' }
    const { data: existing } = await supabase
      .from('landlords').select('id')
      .eq('administration_id', administration_id).ilike('name', name).maybeSingle()
    if (existing) {
      landlordId = (existing as any).id
    } else {
      const insertRow: Record<string, unknown> = { administration_id, name }
      if (input.landlord.dniOrCuit?.trim()) insertRow.dni_or_cuit = input.landlord.dniOrCuit.trim()
      if (input.landlord.phone?.trim())     insertRow.phone       = input.landlord.phone.trim()
      if (input.landlord.email?.trim())     insertRow.email       = input.landlord.email.trim()
      if (input.landlord.notes?.trim())     insertRow.notes       = input.landlord.notes.trim()
      const { data: ins, error: insErr } = await supabase
        .from('landlords').insert(insertRow).select('id').single()
      if (insErr) return dbFailure(insErr)
      landlordId = (ins as any).id
    }
  }

  // ── Resolve / create tenant ───────────────────────────────────────────
  let tenantId: string
  if (input.tenant.kind === 'existing') {
    tenantId = input.tenant.id
  } else {
    const name = clean(input.tenant.name)
    if (!name) return { ok: false, error: 'Nombre del inquilino vacío.' }
    const { data: existing } = await supabase
      .from('tenants').select('id')
      .eq('administration_id', administration_id).ilike('name', name).maybeSingle()
    if (existing) {
      tenantId = (existing as any).id
    } else {
      const insertRow: Record<string, unknown> = { administration_id, name }
      if (input.tenant.dni?.trim())   insertRow.dni   = input.tenant.dni.trim()
      if (input.tenant.phone?.trim()) insertRow.phone = input.tenant.phone.trim()
      if (input.tenant.email?.trim()) insertRow.email = input.tenant.email.trim()
      const { data: ins, error: insErr } = await supabase
        .from('tenants').insert(insertRow).select('id').single()
      if (insErr) return dbFailure(insErr)
      tenantId = (ins as any).id
    }
  }

  // ── Create the property (one per contract — same pattern as the import).
  //    The address falls back to a "Propiedad de <landlord>" placeholder that
  //    the encargada can fix from the contract detail page later.
  const { data: landlordRow } = await supabase
    .from('landlords').select('name').eq('id', landlordId).maybeSingle()
  const landlordName = (landlordRow as any)?.name ?? 'propietario'
  const address = clean(input.address ?? '') || `Propiedad de ${landlordName}`
  const { data: prop, error: propErr } = await supabase
    .from('properties')
    .insert({ administration_id, address, property_type: 'vivienda' })
    .select('id').single()
  if (propErr) return dbFailure(propErr)
  const propertyId = (prop as any).id as string

  // ── Property-level co-ownership junction (this landlord owns it 100%).
  const { error: plErr } = await supabase
    .from('property_landlords')
    .insert({ property_id: propertyId, landlord_id: landlordId, ownership_pct: 100 })
  if (plErr) return dbFailure(plErr)

  // ── Create the contract.
  const { data: contract, error: contractErr } = await supabase
    .from('contracts')
    .insert({
      administration_id,
      property_id:       propertyId,
      current_rent:      input.currentRent,
      initial_rent:      input.currentRent,
      expensas:          0,
      currency:          'ARS',
      indexer:           'IPC_GENERAL',
      cadence:           input.cadence,
      start_date:        input.startDate,
      end_date:          input.endDate,
      payment_day:       5,
      status:            'active',
      lfa_code:          input.lfaCode,
      commission_pct:    input.commissionPct,
    })
    .select('id').single()
  if (contractErr) return dbFailure(contractErr)
  const contractId = (contract as any).id as string

  // ── Junctions
  const { error: ctErr } = await supabase
    .from('contract_tenants')
    .insert({ contract_id: contractId, tenant_id: tenantId, is_primary: true })
  if (ctErr) return dbFailure(ctErr)

  const { error: clErr } = await supabase
    .from('contract_landlords')
    .insert({ contract_id: contractId, landlord_id: landlordId, ownership_pct: 100 })
  if (clErr) return dbFailure(clErr)

  revalidatePath('/liquidacion')
  revalidatePath('/contratos')
  return { ok: true, error: null, contractId }
}

// ── helpers ─────────────────────────────────────────────────────────────────

function cleanName(name: string): string {
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
  payload:
    | { kind: 'existing'; landlordId: string }
    | { kind: 'new'; name: string; dniOrCuit?: string | null; phone?: string | null; email?: string | null; notes?: string | null },
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
      const insertRow: Record<string, unknown> = {
        administration_id: (contract as any).administration_id,
        name,
      }
      // Optional fields — only included if provided + non-empty.
      if (payload.dniOrCuit?.trim()) insertRow.dni_or_cuit = payload.dniOrCuit.trim()
      if (payload.phone?.trim())     insertRow.phone       = payload.phone.trim()
      if (payload.email?.trim())     insertRow.email       = payload.email.trim()
      if (payload.notes?.trim())     insertRow.notes       = payload.notes.trim()

      const { data: inserted, error: insErr } = await supabase
        .from('landlords')
        .insert(insertRow)
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

  // Bump contracts.updated_at — junction edits don't touch the contracts
  // row directly, so the planilla's "row floats to top on edit" wouldn't
  // see a Propietario change without this explicit update. Note: this UPDATE
  // also fires the touch_contract_updated_at trigger, which is idempotent.
  await supabase.from('contracts').update({ updated_at: new Date().toISOString() }).eq('id', contractId)

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
  payload:
    | { kind: 'existing'; tenantId: string }
    | { kind: 'new'; name: string; dni?: string | null; phone?: string | null; email?: string | null },
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
      const insertRow: Record<string, unknown> = {
        administration_id: (contract as any).administration_id,
        name,
      }
      if (payload.dni?.trim())   insertRow.dni   = payload.dni.trim()
      if (payload.phone?.trim()) insertRow.phone = payload.phone.trim()
      if (payload.email?.trim()) insertRow.email = payload.email.trim()

      const { data: inserted, error: insErr } = await supabase
        .from('tenants')
        .insert(insertRow)
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

  // Bump contracts.updated_at — same reason as the landlord branch above.
  await supabase.from('contracts').update({ updated_at: new Date().toISOString() }).eq('id', contractId)

  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${contractId}`)
  return { ok: true, error: null }
}
