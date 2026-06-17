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

// ── New picker shapes for the multi-landlord / multi-tenant modal ──────
export type LandlordPick =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; name: string; dniOrCuit?: string | null; phone?: string | null; email?: string | null; notes?: string | null }

export type TenantPick =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; name: string; dni?: string | null; phone?: string | null; email?: string | null }

export interface ContractLandlordInput {
  landlord:     LandlordPick
  ownershipPct: number
}

export interface ContractTenantInput {
  tenant:       TenantPick
  sharePct:     number
}

export interface CreateFromGridInput {
  lfaCode:    string | null
  // Property selection: pick an existing one (auto-uses its current owners
  // by default unless landlords[] is supplied) OR create a new one.
  property:
    | { kind: 'existing'; id: string }
    | { kind: 'new'; address: string; propertyType?: string }
  // Co-owners with their per-contract ownership. Sums must equal 100.
  landlords:  ContractLandlordInput[]
  // Co-tenants with their share. Sums must equal 100.
  tenants:    ContractTenantInput[]
  currentRent:    number
  commissionPct:  number
  startDate:      string  // YYYY-MM-DD
  endDate:        string  // YYYY-MM-DD
  cadence:        string  // mensual / bimestral / trimestral / cuatrimestral / semestral / anual
}

// Percentage-sum tolerance + helpers come from the shared function registry.
// Same constants are used by NewContractModal / EditPropertyForm so client
// and server agree exactly.
import { isPctSum100, pctSum } from '@/lib/shared'

const ALLOWED_CADENCES = ['mensual', 'bimestral', 'trimestral', 'cuatrimestral', 'semestral', 'anual']

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

export async function createContractFromGrid(input: CreateFromGridInput): Promise<CreateFromGridResult> {
  try {
    const supabase = await createSupabaseServer()

    // ── Basic numeric / date / cadence validation ─────────────────────────
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

    // ── Validate the landlord / tenant arrays ─────────────────────────────
    if (!Array.isArray(input.landlords) || input.landlords.length === 0) {
      return { ok: false, error: 'Tenés que cargar al menos un propietario.' }
    }
    if (!Array.isArray(input.tenants) || input.tenants.length === 0) {
      return { ok: false, error: 'Tenés que cargar al menos un inquilino.' }
    }
    const landlordPcts = input.landlords.map(l => l.ownershipPct)
    if (!isPctSum100(landlordPcts)) {
      return { ok: false, error: `Los porcentajes de propietarios deben sumar 100% (suman ${pctSum(landlordPcts).toFixed(2)}%).` }
    }
    const tenantPcts = input.tenants.map(t => t.sharePct)
    if (!isPctSum100(tenantPcts)) {
      return { ok: false, error: `Los porcentajes de inquilinos deben sumar 100% (suman ${pctSum(tenantPcts).toFixed(2)}%).` }
    }
    for (const l of input.landlords) {
      if (!isFinite(l.ownershipPct) || l.ownershipPct <= 0 || l.ownershipPct > 100) {
        return { ok: false, error: 'Cada propietario debe tener un porcentaje entre 0 y 100.' }
      }
    }
    for (const t of input.tenants) {
      if (!isFinite(t.sharePct) || t.sharePct <= 0 || t.sharePct > 100) {
        return { ok: false, error: 'Cada inquilino debe tener un porcentaje entre 0 y 100.' }
      }
    }

    // ── Resolve administration_id from the seeded administration. ─────────
    const { data: admin, error: adminErr } = await supabase
      .from('administrations').select('id').limit(1).maybeSingle()
    if (adminErr) return dbFailure(adminErr)
    if (!admin)   return { ok: false, error: 'No hay administración configurada.' }
    const administration_id = (admin as any).id as string

    // ── Resolve every landlord pick to a UUID, creating new rows as needed.
    const landlordRows: { id: string; ownershipPct: number }[] = []
    const seenLandlordIds = new Set<string>()
    for (const row of input.landlords) {
      const id = await resolveLandlord(supabase, administration_id, row.landlord)
      if (typeof id !== 'string') return id   // already a failure result
      if (seenLandlordIds.has(id)) {
        return { ok: false, error: 'No podés repetir el mismo propietario dos veces.' }
      }
      seenLandlordIds.add(id)
      landlordRows.push({ id, ownershipPct: row.ownershipPct })
    }

    // ── Resolve every tenant pick to a UUID, creating new rows as needed.
    const tenantRows: { id: string; sharePct: number }[] = []
    const seenTenantIds = new Set<string>()
    for (const row of input.tenants) {
      const id = await resolveTenant(supabase, administration_id, row.tenant)
      if (typeof id !== 'string') return id
      if (seenTenantIds.has(id)) {
        return { ok: false, error: 'No podés repetir el mismo inquilino dos veces.' }
      }
      seenTenantIds.add(id)
      tenantRows.push({ id, sharePct: row.sharePct })
    }

    // ── Property — existing or new ────────────────────────────────────────
    let propertyId: string
    let propertyIsNew = false
    if (input.property.kind === 'existing') {
      propertyId = input.property.id
    } else {
      const address = clean(input.property.address)
      if (!address) return { ok: false, error: 'Ingresá la dirección de la propiedad.' }
      const propertyType = input.property.propertyType || 'vivienda'
      const { data: prop, error: propErr } = await supabase
        .from('properties')
        .insert({ administration_id, address, property_type: propertyType })
        .select('id').single()
      if (propErr) return dbFailure(propErr)
      propertyId = (prop as any).id as string
      propertyIsNew = true
    }

    // ── property_landlords: only seed it for NEW properties. Existing
    //    properties already have their general ownership recorded; the
    //    per-contract distribution lives in contract_landlords and may
    //    diverge intentionally.
    if (propertyIsNew) {
      const plRows = landlordRows.map(l => ({
        property_id:    propertyId,
        landlord_id:    l.id,
        ownership_pct:  l.ownershipPct,
      }))
      const { error: plErr } = await supabase.from('property_landlords').insert(plRows)
      if (plErr) return dbFailure(plErr)
    }

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

    // ── contract_landlords: one row per co-owner ──────────────────────────
    const clRows = landlordRows.map(l => ({
      contract_id:    contractId,
      landlord_id:    l.id,
      ownership_pct:  l.ownershipPct,
    }))
    const { error: clErr } = await supabase.from('contract_landlords').insert(clRows)
    if (clErr) return dbFailure(clErr)

    // ── contract_tenants: one row per co-tenant. The HIGHEST sharePct
    //    becomes is_primary so legacy "primary tenant" queries keep working.
    let primaryIdx = 0
    for (let i = 1; i < tenantRows.length; i++) {
      if (tenantRows[i].sharePct > tenantRows[primaryIdx].sharePct) primaryIdx = i
    }
    const ctRows = tenantRows.map((t, i) => ({
      contract_id: contractId,
      tenant_id:   t.id,
      is_primary:  i === primaryIdx,
      share_pct:   t.sharePct,
    }))
    const { error: ctErr } = await supabase.from('contract_tenants').insert(ctRows)
    if (ctErr) return dbFailure(ctErr)

    // Aggressive cache invalidation.
    revalidatePath('/', 'layout')
    return { ok: true, error: null, contractId }
  } catch (err) {
    console.error('[createContractFromGrid] failed:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Error inesperado al crear el contrato.' }
  }
}

// ── Helpers: resolve a LandlordPick / TenantPick to a UUID, creating
//    new rows when needed. Returns a string id on success, or a failure
//    CreateFromGridResult on error (so callers can `return id` to bail).
async function resolveLandlord(
  supabase:           Awaited<ReturnType<typeof createSupabaseServer>>,
  administration_id:  string,
  pick:               LandlordPick,
): Promise<string | CreateFromGridResult> {
  if (pick.kind === 'existing') return pick.id

  const name = clean(pick.name)
  if (!name) return { ok: false, error: 'Nombre del propietario vacío.' }

  const { data: existing } = await supabase
    .from('landlords').select('id')
    .eq('administration_id', administration_id)
    .ilike('name', name)
    .maybeSingle()
  if (existing) return (existing as any).id

  const insertRow: Record<string, unknown> = { administration_id, name }
  if (pick.dniOrCuit?.trim()) insertRow.dni_or_cuit = pick.dniOrCuit.trim()
  if (pick.phone?.trim())     insertRow.phone       = pick.phone.trim()
  if (pick.email?.trim())     insertRow.email       = pick.email.trim()
  if (pick.notes?.trim())     insertRow.notes       = pick.notes.trim()
  const { data: ins, error: insErr } = await supabase
    .from('landlords').insert(insertRow).select('id').single()
  if (insErr) return dbFailure(insErr)
  return (ins as any).id
}

async function resolveTenant(
  supabase:           Awaited<ReturnType<typeof createSupabaseServer>>,
  administration_id:  string,
  pick:               TenantPick,
): Promise<string | CreateFromGridResult> {
  if (pick.kind === 'existing') return pick.id

  const name = clean(pick.name)
  if (!name) return { ok: false, error: 'Nombre del inquilino vacío.' }

  const { data: existing } = await supabase
    .from('tenants').select('id')
    .eq('administration_id', administration_id)
    .ilike('name', name)
    .maybeSingle()
  if (existing) return (existing as any).id

  const insertRow: Record<string, unknown> = { administration_id, name }
  if (pick.dni?.trim())   insertRow.dni   = pick.dni.trim()
  if (pick.phone?.trim()) insertRow.phone = pick.phone.trim()
  if (pick.email?.trim()) insertRow.email = pick.email.trim()
  const { data: ins, error: insErr } = await supabase
    .from('tenants').insert(insertRow).select('id').single()
  if (insErr) return dbFailure(insErr)
  return (ins as any).id
}

// ============================================================================
// Phase 11 — replace a contract's full landlord set in one call.
//
// Mirrors lib/property/actions.ts → updatePropertyOwners. Both use the
// shared isPctSum100() / pctSum() so client + server agree exactly.
// Called from the new multi-owner cell on the planilla.
//
// Strategy: validate, delete all existing contract_landlords rows for the
// contract, insert the new set, bump contracts.updated_at so the planilla
// row-recently-edited tint catches the change.
// ============================================================================

export interface UpdateContractLandlordsResult {
  ok:    boolean
  error: string | null
}

export interface OwnerShareInput {
  landlordId:   string
  ownershipPct: number
}

export async function updateContractLandlords(
  contractId: string,
  rows:       OwnerShareInput[],
): Promise<UpdateContractLandlordsResult> {
  try {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'Tenés que cargar al menos un propietario.' }
    }
    for (const r of rows) {
      if (!r.landlordId) {
        return { ok: false, error: 'Todos los propietarios deben estar seleccionados.' }
      }
      if (!Number.isFinite(r.ownershipPct) || r.ownershipPct <= 0 || r.ownershipPct > 100) {
        return { ok: false, error: 'Cada propietario debe tener un porcentaje entre 0 y 100.' }
      }
    }
    const pcts = rows.map(r => r.ownershipPct)
    if (!isPctSum100(pcts)) {
      return { ok: false, error: `Los porcentajes deben sumar 100% (suman ${pctSum(pcts).toFixed(2)}%).` }
    }
    const seen = new Set<string>()
    for (const r of rows) {
      if (seen.has(r.landlordId)) {
        return { ok: false, error: 'No podés repetir el mismo propietario dos veces.' }
      }
      seen.add(r.landlordId)
    }

    const supabase = await createSupabaseServer()

    const { error: delErr } = await supabase
      .from('contract_landlords').delete().eq('contract_id', contractId)
    if (delErr) return dbFailure(delErr)

    const insertRows = rows.map(r => ({
      contract_id:    contractId,
      landlord_id:    r.landlordId,
      ownership_pct:  r.ownershipPct,
    }))
    const { error: insErr } = await supabase
      .from('contract_landlords').insert(insertRows)
    if (insErr) return dbFailure(insErr)

    // Bump contracts.updated_at so the planilla's "recently edited" tint
    // catches the change (the junction edit doesn't touch contracts).
    await supabase.from('contracts').update({ updated_at: new Date().toISOString() }).eq('id', contractId)

    revalidatePath('/liquidacion')
    revalidatePath(`/contratos/${contractId}`)
    return { ok: true, error: null }
  } catch (err) {
    console.error('[updateContractLandlords] failed:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Error inesperado.' }
  }
}

