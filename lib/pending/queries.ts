// ============================================================================
// Pending actions — operational items the encargada needs to act on this week.
// Three categories, each one resolves with a single outbound communication.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import { getCurrentPeriod } from '@/lib/period'

export type PendingCategory = 'aumento' | 'renovacion' | 'cobranza'

export interface PendingRow {
  contractId:     string
  category:       PendingCategory
  tenantName:     string
  landlordName:   string
  tenantEmail:    string | null
  landlordEmail:  string | null
  /** Days until or since the deadline. Positive = future, negative = past. */
  daysUntilDeadline: number
  /** Current contract rent — shown so she sees the magnitude at a glance. */
  currentRent:    number
  /** Short reason string for the row tooltip / detail view. */
  reason:         string
}

export interface PendingCounts {
  aumento:    number
  renovacion: number
  cobranza:   number
  total:      number
}

export interface PendingResult {
  rows:   PendingRow[]
  counts: PendingCounts
}

const CADENCE_MONTHS: Record<string, number> = {
  mensual: 1, bimestral: 2, trimestral: 3, cuatrimestral: 4, semestral: 6, anual: 12,
}

function nextAdjustmentDate(startDate: string, cadence: string, today: Date): Date | null {
  const months = CADENCE_MONTHS[cadence]
  if (!months) return null
  const next = new Date(startDate)
  let safety = 1000
  while (next <= today && safety-- > 0) next.setMonth(next.getMonth() + months)
  return safety > 0 ? next : null
}

// Period is derived on every call via getCurrentPeriod() — no hardcoding.

/**
 * One pass through every active contract, classifying it into 0, 1, or many
 * pending categories. The same contract can appear in multiple categories
 * (e.g. CAVANNA ROMINA can need both an aviso de aumento AND a renovación).
 */
/** Snooze window: an action marked as "sent" stays dismissed this long. */
const SNOOZE_DAYS = 7

export async function listPendingActions(): Promise<PendingResult> {
  const supabase = await createSupabaseServer()

  const snoozeCutoff = new Date(Date.now() - SNOOZE_DAYS * 86400000).toISOString()

  const [contractsRes, rentTxnsRes, sentRes] = await Promise.all([
    supabase
      .from('contracts')
      .select(`
        id, cadence, start_date, end_date, current_rent, payment_day, status,
        contract_tenants(is_primary, tenants(name, email)),
        contract_landlords(ownership_pct, landlords(name, email))
      `)
      .eq('status', 'active'),
    supabase
      .from('transactions')
      .select('contract_id, transaction_types!inner(code)')
      .eq('period', getCurrentPeriod())
      .eq('transaction_types.code', 'RENT_IN'),
    // Recently-marked-sent rows — these get suppressed from the queue.
    supabase
      .from('pending_actions_sent')
      .select('contract_id, category, sent_at')
      .gte('sent_at', snoozeCutoff),
  ])

  const paidThisPeriod = new Set<string>(
    (rentTxnsRes.data ?? [])
      .map((t: any) => t.contract_id as string | null)
      .filter((id): id is string => !!id),
  )

  // Set of (contractId|category) keys currently snoozed
  const snoozed = new Set<string>(
    (sentRes.data ?? []).map((r: any) => `${r.contract_id}|${r.category}`),
  )
  const isSnoozed = (contractId: string, category: PendingCategory) =>
    snoozed.has(`${contractId}|${category}`)

  const today    = new Date()
  const in30days = new Date(today.getTime() + 30 * 86400000)

  const rows: PendingRow[] = []

  for (const c of (contractsRes.data ?? []) as any[]) {
    const primary  = c.contract_tenants?.find((ct: any) => ct.is_primary) ?? c.contract_tenants?.[0]
    const tenant   = primary?.tenants
    const topOwner = (c.contract_landlords ?? [])
      .slice()
      .sort((a: any, b: any) => Number(b.ownership_pct) - Number(a.ownership_pct))[0]
    const landlord = topOwner?.landlords

    const tenantName    = tenant?.name ?? '(sin inquilino)'
    const landlordName  = landlord?.name ?? '(sin propietario)'
    const tenantEmail   = tenant?.email ?? null
    const landlordEmail = landlord?.email ?? null
    const currentRent   = Number(c.current_rent ?? 0)

    // A. Aviso de aumento — próximo aumento ≤30 días
    const adj = nextAdjustmentDate(c.start_date, c.cadence, today)
    if (adj && adj >= today && adj <= in30days && !isSnoozed(c.id, 'aumento')) {
      const daysUntil = Math.round((adj.getTime() - today.getTime()) / 86400000)
      rows.push({
        contractId: c.id, category: 'aumento',
        tenantName, landlordName, tenantEmail, landlordEmail,
        daysUntilDeadline: daysUntil,
        currentRent,
        reason: `Próximo aumento en ${daysUntil} día${daysUntil === 1 ? '' : 's'}`,
      })
    }

    // B. Renovación — vencimiento ≤30 días
    const end = new Date(c.end_date)
    if (end >= today && end <= in30days && !isSnoozed(c.id, 'renovacion')) {
      const daysUntil = Math.round((end.getTime() - today.getTime()) / 86400000)
      rows.push({
        contractId: c.id, category: 'renovacion',
        tenantName, landlordName, tenantEmail, landlordEmail,
        daysUntilDeadline: daysUntil,
        currentRent,
        reason: `Vence en ${daysUntil} día${daysUntil === 1 ? '' : 's'}`,
      })
    }

    // C. Cobranza vencida — payment_day passed +3 días AND no RENT_IN this period
    const dueDay  = c.payment_day ?? 5
    const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay)
    const overdueMs = today.getTime() - dueDate.getTime()
    if (overdueMs >= 3 * 86400000 && !paidThisPeriod.has(c.id) && !isSnoozed(c.id, 'cobranza')) {
      const daysOverdue = Math.round(overdueMs / 86400000)
      rows.push({
        contractId: c.id, category: 'cobranza',
        tenantName, landlordName, tenantEmail, landlordEmail,
        daysUntilDeadline: -daysOverdue,
        currentRent,
        reason: `${daysOverdue} día${daysOverdue === 1 ? '' : 's'} de atraso`,
      })
    }
  }

  // Sort: cobranza first (overdue is most urgent), then by days until deadline ascending
  const CATEGORY_ORDER: Record<PendingCategory, number> = { cobranza: 0, aumento: 1, renovacion: 2 }
  rows.sort((a, b) => {
    if (CATEGORY_ORDER[a.category] !== CATEGORY_ORDER[b.category]) {
      return CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]
    }
    return a.daysUntilDeadline - b.daysUntilDeadline
  })

  const counts: PendingCounts = {
    cobranza:   rows.filter(r => r.category === 'cobranza').length,
    aumento:    rows.filter(r => r.category === 'aumento').length,
    renovacion: rows.filter(r => r.category === 'renovacion').length,
    total:      rows.length,
  }

  return { rows, counts }
}

/**
 * Lightweight count-only call for the TopBar bell. Skips returning the
 * per-row data when all we need is a number.
 */
/**
 * Bell badge count for the AppShell topbar.
 *
 * Migrated to the new Phase 8 digest: counts only ACTIONABLE items —
 * urgente + importante. Avisos and próximos don't bump the bell because
 * they're not "do today/this week" actions. Old behaviour counted
 * everything (cobranza + aumento + renovacion regardless of urgency)
 * which produced inflated, unhelpful counts (e.g. 128).
 *
 * The bell now reflects what the encargada actually needs to attend to.
 */
export async function getPendingCount(): Promise<number> {
  const { getPendientesDigest } = await import('./digest')
  const { counts } = await getPendientesDigest()
  return counts.urgente + counts.importante
}

export const CATEGORY_LABEL: Record<PendingCategory, string> = {
  cobranza:   'Cobranza vencida',
  aumento:    'Aviso de aumento',
  renovacion: 'Renovación / vencimiento',
}

export const CATEGORY_DESCRIPTION: Record<PendingCategory, string> = {
  cobranza:   'Pago atrasado del período. Email al inquilino con aviso de mora.',
  aumento:    'Aumento de alquiler en ≤30 días. Email al inquilino y propietario con el nuevo monto.',
  renovacion: 'Contrato vence en ≤30 días. Email al propietario para definir renovación o rescisión.',
}
