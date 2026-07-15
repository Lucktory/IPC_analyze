'use server'

// ============================================================================
// Audit logging — app-level events only. Almost everything is captured by DB
// triggers (data changes on every table, plus login/signup on auth.users). The
// one thing the database has no event for is LOGOUT, so it's recorded here.
//
// logAudit NEVER throws: a failure to record must not break the real action.
// ============================================================================

import { getCurrentUser } from '@/lib/auth/current-user'
import { createSupabaseAdmin } from '@/lib/supabase/admin'

export async function logAudit(entry: {
  action:     string
  entityType: string
  entityId?:  string | null
  summary?:   string | null
  before?:    unknown
  after?:     unknown
}): Promise<void> {
  try {
    const me = await getCurrentUser()
    const admin = createSupabaseAdmin()
    await admin.from('audit_log').insert({
      actor_id:    me?.id ?? null,
      actor_email: me?.email ?? null,
      action:      entry.action,
      entity_type: entry.entityType,
      entity_id:   entry.entityId ?? null,
      summary:     entry.summary ?? null,
      before:      entry.before ?? null,
      after:       entry.after ?? null,
      source:      'app',
    })
  } catch {
    // Swallow — auditing must never break the underlying operation.
  }
}

export async function recordLogout(): Promise<void> {
  await logAudit({ action: 'logout', entityType: 'session', summary: 'Cierre de sesion' })
}
