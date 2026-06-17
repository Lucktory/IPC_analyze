// Per-tenant detail (for the /inquilinos/[id] edit page).

import { createSupabaseServer } from '@/lib/supabase/server'

export interface TenantContractRow {
  id:              string
  status:          string
  currentRent:     number
  /** Legacy single-name display (top owner). */
  primaryLandlord: string | null
  /** Phase 11: every co-owner with their pct, sorted by pct desc. */
  landlords:       { id: string; name: string; ownershipPct: number }[]
  /** Phase 11: every co-tenant on this contract (including the one whose
   *  page we're on), sorted by share desc. */
  tenants:         { id: string; name: string; sharePct: number }[]
}

export interface TenantDetail {
  id:       string
  name:     string
  email:    string | null
  phone:    string | null
  dni:      string | null
  // Contract roll-up — used to decide whether delete is even allowed
  contractCount: number
  contracts:     TenantContractRow[]
}

// ── Lightweight lookup — used by the InlineEntityCell autocomplete on the
//    /liquidacion grid. Returns just id + name, sorted by name.
export interface TenantOption { id: string; name: string }

export async function listTenantOptions(): Promise<TenantOption[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('tenants')
    .select('id, name')
    .order('name', { ascending: true })
  return (data ?? []) as TenantOption[]
}

export async function getTenantDetail(id: string): Promise<TenantDetail | null> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('tenants')
    .select(`
      id, name, email, phone, dni,
      contract_tenants(
        contracts(
          id, current_rent, status,
          contract_landlords(ownership_pct, landlords(id, name)),
          contract_tenants(share_pct, tenants(id, name))
        )
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!data) return null
  const t = data as any

  const contracts: TenantContractRow[] = (t.contract_tenants ?? [])
    .map((ct: any) => ct.contracts)
    .filter(Boolean)
    .map((c: any) => {
      // All co-owners with their pct, biggest stake first.
      const landlords = ((c.contract_landlords ?? []) as any[])
        .map(cl => ({
          id:           cl.landlords?.id ?? '',
          name:         cl.landlords?.name ?? '',
          ownershipPct: Number(cl.ownership_pct ?? 0),
        }))
        .filter(l => l.id && l.name)
        .sort((a, b) => b.ownershipPct - a.ownershipPct)

      // All co-tenants on this contract (this tenant + any others) with
      // their share_pct (Phase 11). Falls back to 100 for legacy rows.
      const tenants = ((c.contract_tenants ?? []) as any[])
        .map(ct => ({
          id:        ct.tenants?.id ?? '',
          name:      ct.tenants?.name ?? '',
          sharePct:  Number(ct.share_pct ?? 100),
        }))
        .filter(t => t.id && t.name)
        .sort((a, b) => b.sharePct - a.sharePct)

      return {
        id:              c.id,
        status:          c.status,
        currentRent:     Number(c.current_rent),
        primaryLandlord: landlords[0]?.name ?? null,
        landlords,
        tenants,
      }
    })

  return {
    id:            t.id,
    name:          t.name,
    email:         t.email,
    phone:         t.phone,
    dni:           t.dni,
    contractCount: contracts.length,
    contracts,
  }
}
