// ============================================================================
// Recurring-charges bulk helper for the planilla.
//
// In one Supabase query each, fetch:
//   (a) every active charge across the active contracts
//   (b) every transaction for the period whose type_code matches a charge's
//       recupero_type_code
// Then bucket per contract and produce a per-row summary the planilla cell
// can render directly (total, per-line status, overall green/red dot).
//
// Single source of truth for the cell display, the popover detail, and the
// RECURRING_CHARGE_NOT_RECORDED validation rule.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'

export interface RecurringChargeLine {
  id:                string
  label:             string
  amount:            number
  recuperoTypeCode:  string | null
  /** Was a transaction with this type code recorded for the period?
   *  null when the charge has no type code (untyped → can't check). */
  recorded:          boolean | null
  /** YYYY-MM-DD of the matching transaction's bank_date when recorded. */
  recordedOn:        string | null
}

export interface RecurringChargesSummary {
  contractId:       string
  /** Sum of all active charges' `amount`. */
  totalExpected:    number
  /** Per-line breakdown (active charges only, ordered by sort_order). */
  lines:            RecurringChargeLine[]
  /** Number of active charges with a recupero_type_code set (eligible for
   *  the dot calculation). When 0, the cell shows no dot. */
  typedCount:       number
  /** Number of typed active charges with a matching recorded transaction. */
  recordedCount:    number
  /** Overall status dot:
   *    'complete' = every typed charge has a matching transaction
   *    'missing'  = at least one typed charge has no matching transaction
   *    'na'       = no typed charges (or no charges at all) — show no dot */
  status:           'complete' | 'missing' | 'na'
}

/** Build summaries for every contract id passed in. Contracts with no
 *  active charges still get an entry (totalExpected=0, status='na') so the
 *  caller doesn't have to handle missing-map-key cases. */
export async function buildRecurringChargesSummariesBulk(
  contractIds: string[],
  period:      string,
): Promise<Map<string, RecurringChargesSummary>> {
  const out = new Map<string, RecurringChargesSummary>()
  // Seed empty summaries so every requested id appears in the map.
  for (const id of contractIds) {
    out.set(id, {
      contractId:    id,
      totalExpected: 0,
      lines:         [],
      typedCount:    0,
      recordedCount: 0,
      status:        'na',
    })
  }
  if (contractIds.length === 0) return out

  const supabase = await createSupabaseServer()
  const [chargesRes, txnsRes] = await Promise.all([
    supabase
      .from('contract_recurring_charges')
      .select('id, contract_id, label, amount, recupero_type_code, sort_order')
      .in('contract_id', contractIds)
      .eq('active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('transactions')
      .select('contract_id, bank_date, transaction_types!inner(code)')
      .in('contract_id', contractIds)
      .eq('period', period),
  ])

  // Build a Set of "recorded type codes" per contract for fast lookup.
  // Plus a Map<{contractId, code} → bank_date> for the recordedOn label.
  const recordedKey = (cid: string, code: string) => `${cid}|${code}`
  const recordedDate = new Map<string, string>()
  for (const t of (txnsRes.data ?? []) as any[]) {
    const code = t.transaction_types?.code
    if (!code || !t.contract_id) continue
    const key = recordedKey(t.contract_id, code)
    // First match wins; subsequent matches with a later bank_date override.
    const prior = recordedDate.get(key)
    if (!prior || (t.bank_date && t.bank_date > prior)) {
      if (t.bank_date) recordedDate.set(key, t.bank_date)
      else recordedDate.set(key, prior ?? '')
    }
  }

  // Walk charges, attach to summaries.
  for (const c of (chargesRes.data ?? []) as any[]) {
    const summary = out.get(c.contract_id)
    if (!summary) continue
    const amount = Number(c.amount)
    const typeCode: string | null = c.recupero_type_code ?? null
    let recorded: boolean | null = null
    let recordedOn: string | null = null
    if (typeCode) {
      const key = recordedKey(c.contract_id, typeCode)
      const date = recordedDate.get(key)
      if (date !== undefined) {
        recorded = true
        recordedOn = date || null
      } else {
        recorded = false
      }
      summary.typedCount += 1
      if (recorded) summary.recordedCount += 1
    }
    summary.totalExpected += amount
    summary.lines.push({
      id:               c.id,
      label:            c.label,
      amount,
      recuperoTypeCode: typeCode,
      recorded,
      recordedOn,
    })
  }

  // Compute final status for each summary.
  for (const s of out.values()) {
    if (s.typedCount === 0) {
      s.status = s.lines.length === 0 ? 'na' : 'na'
    } else if (s.recordedCount >= s.typedCount) {
      s.status = 'complete'
    } else {
      s.status = 'missing'
    }
  }
  return out
}

/** Single-contract convenience for the contract detail page. */
export async function buildRecurringChargesSummary(
  contractId: string,
  period:     string,
): Promise<RecurringChargesSummary> {
  const map = await buildRecurringChargesSummariesBulk([contractId], period)
  return map.get(contractId) ?? {
    contractId,
    totalExpected: 0,
    lines:         [],
    typedCount:    0,
    recordedCount: 0,
    status:        'na',
  }
}
