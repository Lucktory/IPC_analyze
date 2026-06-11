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

// ============================================================================
// Bank-institution detail (single bank brand, for /bancos/institucion/[id])
// ============================================================================

export interface BankInstitutionDetail {
  id:               string
  name:             string
  shortCode:        string | null
  monthlyFee:       number | null
  transferFeePct:   number | null
  transferFeeFixed: number | null
  contactName:      string | null
  contactPhone:     string | null
  contactEmail:     string | null
  notes:            string | null
  accountCount:     number
}

export async function getBankInstitution(id: string): Promise<BankInstitutionDetail | null> {
  const supabase = await createSupabaseServer()
  const [bankRes, accountsRes] = await Promise.all([
    supabase
      .from('banks')
      .select(`
        id, name, short_code,
        monthly_fee, transfer_fee_pct, transfer_fee_fixed,
        contact_name, contact_phone, contact_email, notes
      `)
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('bank_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('bank_id', id),
  ])

  if (!bankRes.data) return null
  const row = bankRes.data as any

  return {
    id:               row.id,
    name:             row.name,
    shortCode:        row.short_code,
    monthlyFee:       row.monthly_fee       != null ? Number(row.monthly_fee)       : null,
    transferFeePct:   row.transfer_fee_pct  != null ? Number(row.transfer_fee_pct)  : null,
    transferFeeFixed: row.transfer_fee_fixed != null ? Number(row.transfer_fee_fixed) : null,
    contactName:      row.contact_name,
    contactPhone:     row.contact_phone,
    contactEmail:     row.contact_email,
    notes:            row.notes,
    accountCount:     accountsRes.count ?? 0,
  }
}
