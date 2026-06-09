'use server'

import { revalidatePath } from 'next/cache'
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
