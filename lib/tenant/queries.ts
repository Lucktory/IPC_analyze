// Per-tenant detail (for the /inquilinos/[id] edit page).

import { createSupabaseServer } from '@/lib/supabase/server'

export interface TenantDetail {
  id:       string
  name:     string
  email:    string | null
  phone:    string | null
  dni:      string | null
  // Contract roll-up — used to decide whether delete is even allowed
  contractCount: number
  contracts:     { id: string; status: string; currentRent: number; primaryLandlord: string | null }[]
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
          contract_landlords(ownership_pct, landlords(name))
        )
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!data) return null
  const t = data as any

  const contracts = (t.contract_tenants ?? [])
    .map((ct: any) => ct.contracts)
    .filter(Boolean)
    .map((c: any) => {
      const topOwner = (c.contract_landlords ?? [])
        .slice()
        .sort((a: any, b: any) => Number(b.ownership_pct) - Number(a.ownership_pct))[0]
      return {
        id:              c.id,
        status:          c.status,
        currentRent:     Number(c.current_rent),
        primaryLandlord: topOwner?.landlords?.name ?? null,
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
