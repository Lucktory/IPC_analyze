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
