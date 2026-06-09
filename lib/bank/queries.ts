// ============================================================================
// Bank-account detail (single account, for the /bancos/[id] edit page).
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'

export interface BankAccountDetail {
  id:            string
  bankId:        string
  bankName:      string
  alias:         string
  accountNumber: string | null
  cbu:           string | null
  accountType:   string
  isActive:      boolean
  ownerType:     'admin' | 'administrator' | 'landlord' | 'unknown'
  ownerLabel:    string
  administrationId: string | null
  administratorId:  string | null
  landlordId:       string | null
}

export async function getBankAccountDetail(id: string): Promise<BankAccountDetail | null> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('bank_accounts')
    .select(`
      id, alias, account_number, cbu, account_type, is_active,
      bank_id, administration_id, administrator_id, landlord_id,
      banks!inner(name),
      administrations(name),
      administrators(name),
      landlords(name)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!data) return null
  const row = data as any

  let ownerType: BankAccountDetail['ownerType'] = 'unknown'
  let ownerLabel = '(sin dueño asignado)'
  if (row.administration_id) {
    ownerType = 'admin'
    ownerLabel = row.administrations?.name ?? 'Pampa Administración'
  } else if (row.administrator_id) {
    ownerType = 'administrator'
    ownerLabel = row.administrators?.name ?? '(socio)'
  } else if (row.landlord_id) {
    ownerType = 'landlord'
    ownerLabel = row.landlords?.name ?? '(propietario)'
  }

  return {
    id:               row.id,
    bankId:           row.bank_id,
    bankName:         row.banks.name,
    alias:            row.alias,
    accountNumber:    row.account_number,
    cbu:              row.cbu,
    accountType:      row.account_type,
    isActive:         row.is_active,
    ownerType,
    ownerLabel,
    administrationId: row.administration_id,
    administratorId:  row.administrator_id,
    landlordId:       row.landlord_id,
  }
}
