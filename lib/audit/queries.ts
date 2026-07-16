'use server'

// ============================================================================
// Audit-log read side. Super-admin only. Reads via the service-role client
// (the table is locked down to that path) and enriches actors with their
// usuarios name/photo for the UI.
// ============================================================================

import { requireSuperAdmin } from '@/lib/auth/current-user'
import { createSupabaseAdmin } from '@/lib/supabase/admin'
import { entityBase } from './format'
import type { AuditEntry, AuditFilters, AuditActor, AuditActionGroup, AuditAnalytics, AuditBucket } from './types'

const PAGE_SIZES = [50, 100] as const
const DEFAULT_PAGE_SIZE = 50

const GROUP_CODES: Record<AuditActionGroup, string[]> = {
  created: ['insert', 'user.create', 'signup'],
  updated: ['update', 'user.update', 'user.role_change', 'user.activate', 'user.deactivate', 'user.photo', 'password.change'],
  deleted: ['delete', 'user.delete'],
  session: ['login', 'logout'],
  user:    ['user.create', 'user.update', 'user.delete', 'user.role_change', 'user.activate', 'user.deactivate', 'user.photo'],
  other:   [],
}

// Mutually-exclusive action buckets for the analytics donut/KPIs. Anything not
// a create/delete/session counts as an edit.
const CREATED_ACTIONS = new Set(['insert', 'user.create', 'signup'])
const DELETED_ACTIONS = new Set(['delete', 'user.delete'])
const SESSION_ACTIONS = new Set(['login', 'logout'])

const ANALYTICS_CAP = 4000

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
  const pageSize = (PAGE_SIZES as readonly number[]).includes(filters.pageSize ?? 0)
    ? (filters.pageSize as number)
    : DEFAULT_PAGE_SIZE
  let q = admin
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })

  const { q: filtered, empty } = await applyAuditFilters(admin, q, filters)
  if (empty) return { ok: true, error: null, entries: [], total: 0, pageSize, refs: {} }
  q = filtered.range((page - 1) * pageSize, (page - 1) * pageSize + pageSize - 1)

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

  return { ok: true, error: null, entries, total: count ?? 0, pageSize, refs }
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
  // The TARGET of a usuarios action is the entry's entity_id — resolve it to a
  // name/email so the UI can show WHO was promoted/demoted/edited.
  const usuarioIds = new Set<string>()
  for (const e of entries) {
    scan(e.before); scan(e.after)
    if (e.entityType === 'usuarios' && typeof e.entityId === 'string' && e.entityId) usuarioIds.add(e.entityId)
  }

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

  // Resolve usuarios targets to name (or email as fallback).
  if (usuarioIds.size) {
    const { data } = await admin.from('usuarios').select('id, full_name, email').in('id', [...usuarioIds])
    for (const row of (data ?? []) as any[]) {
      const label = row.full_name || row.email
      if (row.id && label) refs[row.id] = String(label)
    }
  }
  return refs
}

export async function getAuditActors(): Promise<AuditActor[]> {
  if (!(await requireSuperAdmin())) return []
  let admin
  try { admin = createSupabaseAdmin() } catch { return [] }
  const { data } = await admin.from('usuarios').select('id, full_name, email').order('full_name', { ascending: true })
  return (data ?? []).map((u: any) => ({ id: u.id, name: u.full_name || u.email, email: u.email }))
}

// ── Shared filter builder (list + analytics stay in sync) ────────────────────
// Applies the actor / entity / date / action-group / contract filters to a query
// builder. Returns { empty: true } when a contract search matched no contract
// (so the caller can short-circuit to an empty result).
async function applyAuditFilters(admin: any, q: any, filters: AuditFilters): Promise<{ q: any; empty: boolean }> {
  if (filters.actorId)    q = q.eq('actor_id', filters.actorId)
  if (filters.entityType) q = q.eq('entity_type', filters.entityType)
  if (filters.from)       q = q.gte('occurred_at', filters.from)
  if (filters.to)         q = q.lte('occurred_at', filters.to)
  if (filters.group && GROUP_CODES[filters.group]?.length) q = q.in('action', GROUP_CODES[filters.group])
  // Contract search: resolve the typed number to contract uuid(s), then match
  // audit rows where the contract IS the entity or its uuid appears as
  // contract_id inside the before/after snapshot.
  if (filters.query?.trim()) {
    const cq = filters.query.trim()
    const { data: cs } = await admin.from('contracts').select('id').ilike('contract_number', `%${cq}%`)
    const ids = [...new Set((cs ?? []).map((c: any) => c.id).filter(Boolean))] as string[]
    if (!ids.length) return { q, empty: true }
    const list = ids.map(uuid => `"${uuid}"`).join(',')
    q = q.or(`entity_id.in.(${list}),before->>contract_id.in.(${list}),after->>contract_id.in.(${list})`)
  }
  return { q, empty: false }
}

// The contract a row relates to: itself (contracts entity) or a referenced
// contract_id in the snapshot.
function contractUuidOf(r: any): string | null {
  if (r.entity_type === 'contracts' && typeof r.entity_id === 'string' && r.entity_id) return r.entity_id
  if (typeof r.after_cid  === 'string' && r.after_cid)  return r.after_cid
  if (typeof r.before_cid === 'string' && r.before_cid) return r.before_cid
  return null
}

function emptyAnalytics(): AuditAnalytics {
  return {
    total: 0, capped: false, created: 0, updated: 0, deleted: 0, session: 0,
    distinctActors: 0, distinctContracts: 0, lastActivity: null,
    timeBuckets: [], bucketUnit: 'day', byEntity: [], byActor: [], byContract: [],
  }
}

// Group audit rows into a continuous time axis. <= 92 days -> daily buckets
// (gap-filled); longer -> monthly buckets. Days are computed in AR time.
function buildTimeBuckets(rows: any[], fromISO: string | null, toISO: string | null): { unit: 'day' | 'month'; buckets: AuditBucket[] } {
  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const dayCount = new Map<string, number>()
  let minDay: string | null = null, maxDay: string | null = null
  for (const r of rows) {
    const d = dayFmt.format(new Date(r.occurred_at)) // YYYY-MM-DD
    dayCount.set(d, (dayCount.get(d) ?? 0) + 1)
    if (!minDay || d < minDay) minDay = d
    if (!maxDay || d > maxDay) maxDay = d
  }
  const startStr = fromISO ? fromISO.slice(0, 10) : minDay
  const endStr   = toISO   ? toISO.slice(0, 10)   : maxDay
  if (!startStr || !endStr) return { unit: 'day', buckets: [] }

  const start = new Date(startStr + 'T00:00:00Z')
  const end   = new Date(endStr + 'T00:00:00Z')
  const spanDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1

  if (spanDays <= 92) {
    const buckets: AuditBucket[] = []
    for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
      const key = new Date(t).toISOString().slice(0, 10)
      buckets.push({ label: `${key.slice(8, 10)}/${key.slice(5, 7)}`, value: dayCount.get(key) ?? 0 })
    }
    return { unit: 'day', buckets }
  }

  // Monthly
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const monthCount = new Map<string, number>()
  for (const [d, n] of dayCount) {
    const mk = d.slice(0, 7) // YYYY-MM
    monthCount.set(mk, (monthCount.get(mk) ?? 0) + n)
  }
  const buckets: AuditBucket[] = []
  let y = start.getUTCFullYear(), m = start.getUTCMonth()
  const ey = end.getUTCFullYear(), em = end.getUTCMonth()
  while (y < ey || (y === ey && m <= em)) {
    const mk = `${y}-${String(m + 1).padStart(2, '0')}`
    buckets.push({ label: `${MONTHS[m]} ${String(y).slice(2)}`, value: monthCount.get(mk) ?? 0 })
    m++; if (m > 11) { m = 0; y++ }
  }
  return { unit: 'month', buckets }
}

export async function getAuditAnalytics(filters: AuditFilters): Promise<{ ok: boolean; error: string | null; analytics?: AuditAnalytics }> {
  if (!(await requireSuperAdmin())) return { ok: false, error: 'No autorizado.' }
  let admin
  try { admin = createSupabaseAdmin() } catch (e) { return { ok: false, error: (e as Error).message } }

  let q = admin
    .from('audit_log')
    .select('occurred_at, action, entity_type, entity_id, actor_id, actor_email, before_cid:before->>contract_id, after_cid:after->>contract_id')
    .order('occurred_at', { ascending: false })

  const { q: filtered, empty } = await applyAuditFilters(admin, q, filters)
  if (empty) return { ok: true, error: null, analytics: emptyAnalytics() }

  const { data, error } = await filtered.limit(ANALYTICS_CAP)
  if (error) return { ok: false, error: error.message }
  const rows = (data ?? []) as any[]

  let created = 0, updated = 0, deleted = 0, session = 0
  let lastActivity: string | null = null
  const entityCount   = new Map<string, number>()
  const actorCount    = new Map<string, number>()   // key: actor_id or '__sys'
  const actorEmail    = new Map<string, string | null>()
  const contractCount = new Map<string, number>()
  const actorIds      = new Set<string>()

  for (const r of rows) {
    if (!lastActivity || r.occurred_at > lastActivity) lastActivity = r.occurred_at
    const a = r.action as string
    if (CREATED_ACTIONS.has(a)) created++
    else if (DELETED_ACTIONS.has(a)) deleted++
    else if (SESSION_ACTIONS.has(a)) session++
    else updated++

    entityCount.set(r.entity_type, (entityCount.get(r.entity_type) ?? 0) + 1)

    const aid = r.actor_id ?? '__sys'
    actorCount.set(aid, (actorCount.get(aid) ?? 0) + 1)
    if (r.actor_id) { actorIds.add(r.actor_id); actorEmail.set(aid, r.actor_email ?? null) }

    const cu = contractUuidOf(r)
    if (cu) contractCount.set(cu, (contractCount.get(cu) ?? 0) + 1)
  }

  // Resolve actor names + contract numbers for readable labels.
  const nameById = new Map<string, string>()
  if (actorIds.size) {
    const { data: us } = await admin.from('usuarios').select('id, full_name, email').in('id', [...actorIds])
    for (const u of (us ?? []) as any[]) nameById.set(u.id, u.full_name || u.email)
  }
  const numById = new Map<string, string>()
  if (contractCount.size) {
    const { data: cs } = await admin.from('contracts').select('id, contract_number').in('id', [...contractCount.keys()])
    for (const c of (cs ?? []) as any[]) if (c.contract_number) numById.set(c.id, c.contract_number)
  }

  const byEntity: AuditBucket[] = [...entityCount.entries()]
    .map(([k, v]) => ({ label: entityBase(k), value: v }))
    .sort((a, b) => b.value - a.value).slice(0, 8)

  const byActor: AuditBucket[] = [...actorCount.entries()]
    .map(([k, v]) => ({
      label: k === '__sys' ? 'Sistema' : (nameById.get(k) || (actorEmail.get(k) ?? '').split('@')[0] || 'Usuario'),
      value: v,
    }))
    .sort((a, b) => b.value - a.value).slice(0, 8)

  const byContract: AuditBucket[] = [...contractCount.entries()]
    .map(([k, v]) => ({ label: numById.get(k) || k.slice(0, 8), value: v }))
    .sort((a, b) => b.value - a.value).slice(0, 8)

  const { unit, buckets } = buildTimeBuckets(rows, filters.from ?? null, filters.to ?? null)

  return {
    ok: true,
    error: null,
    analytics: {
      total: rows.length,
      capped: rows.length >= ANALYTICS_CAP,
      created, updated, deleted, session,
      distinctActors: actorCount.size,
      distinctContracts: contractCount.size,
      lastActivity,
      timeBuckets: buckets,
      bucketUnit: unit,
      byEntity, byActor, byContract,
    },
  }
}
