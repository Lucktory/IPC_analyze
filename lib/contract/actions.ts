'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'

export interface SaveNoteResult {
  ok:    boolean
  error: string | null
}

export async function saveContractPeriodNote(
  contractId: string,
  period:     string,    // YYYY-MM-DD (first-of-month)
  formData:   FormData,
): Promise<SaveNoteResult> {
  const body = String(formData.get('body') ?? '')

  const supabase = await createSupabaseServer()
  const { data: userRes } = await supabase.auth.getUser()
  const editor = userRes?.user?.email ?? null

  const { error } = await supabase
    .from('contract_period_notes')
    .upsert(
      {
        contract_id: contractId,
        period,
        body,
        updated_at: new Date().toISOString(),
        updated_by: editor,
      },
      { onConflict: 'contract_id,period' },
    )

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/contratos/${contractId}`)
  return { ok: true, error: null }
}
