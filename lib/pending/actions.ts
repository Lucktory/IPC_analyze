'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { PendingCategory } from './queries'

export interface MarkSentResult {
  ok:    boolean
  error: string | null
}

/**
 * Mark a pending action as "sent". The row drops off /pendientes for 7
 * days (the snooze window in listPendingActions). On re-marking the same
 * (contract × category), upsert resets sent_at to now() — effectively
 * starts a fresh 7-day snooze.
 */
export async function markActionSent(
  contractId: string,
  category:   PendingCategory,
): Promise<MarkSentResult> {
  const supabase = await createSupabaseServer()

  const { data: userRes } = await supabase.auth.getUser()
  const sentBy = userRes?.user?.email ?? null

  const { error } = await supabase
    .from('pending_actions_sent')
    .upsert(
      {
        contract_id: contractId,
        category,
        sent_at:     new Date().toISOString(),
        sent_by:     sentBy,
      },
      { onConflict: 'contract_id,category' },
    )

  if (error) return { ok: false, error: error.message }

  revalidatePath('/pendientes')
  revalidatePath('/dashboard')   // bell badge feeds from same data
  return { ok: true, error: null }
}

/**
 * Undo a snooze — bring the action back to the queue immediately.
 */
export async function unmarkActionSent(
  contractId: string,
  category:   PendingCategory,
): Promise<MarkSentResult> {
  const supabase = await createSupabaseServer()

  const { error } = await supabase
    .from('pending_actions_sent')
    .delete()
    .eq('contract_id', contractId)
    .eq('category', category)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/pendientes')
  revalidatePath('/dashboard')
  return { ok: true, error: null }
}
