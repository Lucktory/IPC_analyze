'use server'

// ============================================================================
// Audit-log read side. Super-admin only. Reads via the service-role client
// (the table is locked down to that path) and enriches actors with their
// usuarios name/photo for the UI.
// ============================================================================

import { requireSuperAdmin } from '@/lib/auth/current-user'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import type { AuditEntry, AuditFilters, AuditActor, AuditActionGroup } from './types'

const PAGE_SIZE = 10

const GROUP_CODES: Record<AuditActionGroup, string[]> = {
  created: ['insert', 'user.create', 'signup'],
  updated: ['update', 'user.update', 'user.role_change', 'user.activate', 'user.deactivate', 'user.photo', 'password.change'],
  deleted: ['delete', 'user.delete'],
  session: ['login', 'logout'],
  user:    ['user.create', 'user.update', 'user.delete', 'user.role_change', 'user.activate', 'user.deactivate', 'user.photo'],
  other:   [],
}

function mapEntry(r: any, umap: Map<string, { full_name: string | null; email: string; photo_url: string | null }>): AuditEntry {
  const u = r.actor_id ? umap.get(r.actor_id) : undefined
  return {
    id:         Number(r.id),
    occurredAt: r.occurred_at,
    actorId:    r.actor_id ?? null,
    actorEmail: r.actor_email ?? u?.email ?? null,
    action:     r.action,
    entityType: r.entity_type,
    entityId:   r.entity_id ?? null,
    summary:    r.summary ?? null,
    before:     (r.before ?? null) as Record<string, unknown> | null,
    after:      (r.after ?? null) as Record<string, unknown> | null,
    source:     r.source ?? 'trigger',
    actorName:  u?.full_name ?? null,
    actorPhotoUrl: u?.photo_url ?? null,
  }
}

export async function listAuditLog(filters: AuditFilters): Promise<{
  ok: boolean; error: string | null; entries?: AuditEntry[]; total?: number; pageSize?: number
  refs?: Record<string, string>
}> {
  if (!(await requireSuperAdmin())) return { ok: false, error: 'No autorizado.' }
  let admin
  try { admin = createSupabaseAdmin() } catch (e) { return { ok: false, error: (e as Error).message } }

  const page = Math.max(1, filters.page ?? 1)
  let q = admin
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })

  if (filters.actorId)    q = q.eq('actor_id', filters.actorId)
  if (filters.entityType) q = q.eq('entity_type', filters.entityType)
  if (filters.from)       q = q.gte('occurred_at', filters.from)
  if (filters.to)         q = q.lte('occurred_at', filters.to)
  if (filters.group && GROUP_CODES[filters.group]?.length) q = q.in('action', GROUP_CODES[filters.group])
  if (filters.query?.trim()) {
    const s = filters.query.trim().replace(/[%,]/g, ' ')
    q = q.or(`entity_id.ilike.%${s}%,summary.ilike.%${s}%,entity_type.ilike.%${s}%,actor_email.ilike.%${s}%`)
  }

  q = q.range((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE - 1)

  const { data, error, count } = await q
  if (error) return { ok: false, error: error.message }

  const actorIds = [...new Set((data ?? []).map((r: any) => r.actor_id).filter(Boolean))] as string[]
  const umap = new Map<string, { full_name: string | null; email: string; photo_url: string | null }>()
  if (actorIds.length) {
    const { data: users } = await admin.from('usuarios').select('id, full_name, email, photo_url').in('id', actorIds)
    for (const u of (users ?? []) as any[]) umap.set(u.id, { full_name: u.full_name, email: u.email, photo_url: u.photo_url })
  }

  const entries = (data ?? []).map((r: any) => mapEntry(r, umap))
  const refs = await resolveRefs(admin, entries)

  return { ok: true, error: null, entries, total: count ?? 0, pageSize: PAGE_SIZE, refs }
}

// Resolve foreign-key uuids appearing in the diffs (contract_id, landlord_id,
// etc.) to human names, so the UI shows "C-2024-0045" instead of a raw uuid.
async function resolveRefs(admin: ReturnType<typeof createSupabaseAdmin>, entries: AuditEntry[]): Promise<Record<string, string>> {
  const buckets: Record<string, Set<string>> = {
    contract_id: new Set(), landlord_id: new Set(), tenant_id: new Set(),
    property_id: new Set(), bank_account_id: new Set(), bank_id: new Set(),
  }
  const scan = (j: Record<string, unknown> | null) => {
    if (!j) return
    for (const f of Object.keys(buckets)) {
      const v = j[f]
      if (typeof v === 'string' && v) buckets[f].add(v)
    }
  }
  for (const e of entries) { scan(e.before); scan(e.after) }

  const refs: Record<string, string> = {}
  const lookups: Array<[string, string, Set<string>]> = [
    ['contracts', 'contract_number', buckets.contract_id],
    ['landlords', 'name', buckets.landlord_id],
    ['tenants', 'name', buckets.tenant_id],
    ['properties', 'address', buckets.property_id],
    ['bank_accounts', 'alias', buckets.bank_account_id],
    ['banks', 'name', buckets.bank_id],
  ]
  await Promise.all(lookups.map(async ([table, label, ids]) => {
    if (!ids.size) return
    const { data } = await admin.from(table).select(`id, ${label}`).in('id', [...ids])
    for (const row of (data ?? []) as any[]) if (row.id && row[label]) refs[row.id] = String(row[label])
  }))
  return refs
}

export async function getAuditActors(): Promise<AuditActor[]> {
  if (!(await requireSuperAdmin())) return []
  let admin
  try { admin = createSupabaseAdmin() } catch { return [] }
  const { data } = await admin.from('usuarios').select('id, full_name, email').order('full_name', { ascending: true })
  return (data ?? []).map((u: any) => ({ id: u.id, name: u.full_name || u.email, email: u.email }))
}
