'use server'

import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'

export interface UpdateBankAccountResult {
  ok:    boolean
  error: string | null
}

export async function updateBankAccount(
  id:       string,
  formData: FormData,
): Promise<UpdateBankAccountResult> {
  const fields = {
    alias:          String(formData.get('alias')          ?? '').trim(),
    account_number: String(formData.get('account_number') ?? '').trim() || null,
    cbu:            String(formData.get('cbu')            ?? '').trim() || null,
    account_type:   String(formData.get('account_type')   ?? 'CA').trim(),
    bank_id:        String(formData.get('bank_id')        ?? '').trim() || null,
    is_active:      formData.get('is_active') === 'on',
  }

  if (!fields.alias) {
    return { ok: false, error: 'El alias no puede estar vacío.' }
  }
  if (!fields.bank_id) {
    return { ok: false, error: 'Seleccioná un banco.' }
  }
  if (!['CA', 'CC', 'USD'].includes(fields.account_type)) {
    return { ok: false, error: 'Tipo de cuenta inválido.' }
  }

  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('bank_accounts').update(fields).eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/bancos')
  revalidatePath(`/bancos/${id}`)
  return { ok: true, error: null }
}

export interface DeleteBankAccountResult {
  ok:    boolean
  error: string | null
}

/**
 * Hard delete a bank account. `transactions.bank_account_id` and
 * `contracts.bank_account_id` reference us with no ON DELETE clause, which
 * defaults to NO ACTION → Postgres blocks the delete with a FK violation.
 * We catch and translate.
 */
export async function deleteBankAccount(id: string): Promise<DeleteBankAccountResult> {
  const supabase  = await createSupabaseServer()
  const { error } = await supabase.from('bank_accounts').delete().eq('id', id)

  if (error) {
    if ((error as any).code === '23503' || /foreign key/i.test(error.message)) {
      return {
        ok: false,
        error: 'No se puede eliminar: la cuenta tiene movimientos o contratos asociados.',
      }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/bancos')
  redirect('/bancos')
}

// ============================================================================
// Bank-institution (banks master list) CRUD
// ============================================================================

export interface BankInstitutionResult {
  ok:    boolean
  error: string | null
  id?:   string
}

function parseInstitutionFields(formData: FormData) {
  const num = (v: FormDataEntryValue | null): number | null => {
    const s = String(v ?? '').trim()
    if (!s) return null
    const n = Number(s)
    return isNaN(n) ? null : n
  }
  const txt = (v: FormDataEntryValue | null): string | null => {
    const s = String(v ?? '').trim()
    return s || null
  }
  return {
    name:               String(formData.get('name') ?? '').trim(),
    short_code:         txt(formData.get('short_code')),
    monthly_fee:        num(formData.get('monthly_fee')),
    transfer_fee_pct:   num(formData.get('transfer_fee_pct')),
    transfer_fee_fixed: num(formData.get('transfer_fee_fixed')),
    contact_name:       txt(formData.get('contact_name')),
    contact_phone:      txt(formData.get('contact_phone')),
    contact_email:      txt(formData.get('contact_email')),
    notes:              txt(formData.get('notes')),
  }
}

export async function createBankInstitution(formData: FormData): Promise<BankInstitutionResult> {
  const fields = parseInstitutionFields(formData)
  if (!fields.name) return { ok: false, error: 'El nombre no puede estar vacío.' }

  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('banks')
    .insert(fields)
    .select('id')
    .single()

  if (error) {
    // 23505 = unique_violation. The banks.name has a UNIQUE constraint.
    if ((error as any).code === '23505') {
      return { ok: false, error: 'Ya existe un banco con ese nombre.' }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/bancos')
  redirect(`/bancos/institucion/${(data as any).id}`)
}

export async function updateBankInstitution(id: string, formData: FormData): Promise<BankInstitutionResult> {
  const fields = parseInstitutionFields(formData)
  if (!fields.name) return { ok: false, error: 'El nombre no puede estar vacío.' }

  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('banks').update(fields).eq('id', id)

  if (error) {
    if ((error as any).code === '23505') {
      return { ok: false, error: 'Ya existe un banco con ese nombre.' }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/bancos')
  revalidatePath(`/bancos/institucion/${id}`)
  return { ok: true, error: null }
}

export async function deleteBankInstitution(id: string): Promise<BankInstitutionResult> {
  const supabase  = await createSupabaseServer()
  const { error } = await supabase.from('banks').delete().eq('id', id)

  if (error) {
    if ((error as any).code === '23503' || /foreign key/i.test(error.message)) {
      return {
        ok: false,
        error: 'No se puede eliminar: el banco tiene cuentas asociadas. Primero reasigná o eliminá esas cuentas.',
      }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/bancos')
  redirect('/bancos?tab=instituciones')
}
