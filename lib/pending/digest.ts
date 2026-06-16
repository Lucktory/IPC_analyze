// ============================================================================
// Pendientes digest — the unified "what needs my attention" feed (Phase 8).
//
// Replaces the old listPendingActions in lib/pending/queries.ts with a much
// richer fan-out across SIX signal streams. Each stream contributes 0 or
// more items, each item carries its severity tier and a suggested action.
// The page groups everything into four accordions by severity.
//
// Streams:
//   1. Cobranzas         — rent collection (due dates vs RENT_IN)
//   2. Aumentos          — IPC rent adjustments (next adjustment date)
//   3. Validación        — Phase 7A validation errors and warnings
//   4. Workflow          — liquidación status anomalies
//   5. Contrato          — contract end_date approaching / expired
//   6. Datos             — data hygiene (missing email / phone)
//
// Reuses getLiquidacionGridForPeriod so validation issues + period totals
// come straight from the same source the planilla uses — single source of
// truth across both screens.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import { getCurrentPeriod } from '@/lib/period'
import { getLiquidacionGridForPeriod, type LiquidacionGridRow } from '@/lib/liquidacion/queries'

export type Severity   = 'urgente' | 'importante' | 'proximo' | 'aviso'
export type StreamType = 'cobranza' | 'aumento' | 'validacion' | 'workflow' | 'contrato' | 'datos'

export interface PendienteItem {
  /** Stable unique key for React + snooze. */
  id:           string
  severity:     Severity
  type:         StreamType
  contractId:   string
  landlordName: string
  tenantName:   string
  tenantPhone:  string | null
  landlordEmail: string | null
  title:        string
  detail:       string
  /** Days until due (positive) or past due (negative). Null if not date-driven. */
  daysContext:  number | null
  /** Money amount this item is about, when applicable (rent, etc.). */
  amount:       number | null
  /** Issue count on this row — used by validation summaries. */
  issueCount:   number | null
}

export interface PendienteCounts {
  urgente:    number
  importante: number
  proximo:    number
  aviso:      number
  total:      number
}

export interface PendienteDigest {
  items:  PendienteItem[]
  counts: PendienteCounts
  /** ISO YYYY-MM-01 of the period the digest was computed against. */
  period: string
}

// ── Thresholds (cobranza) — Option A from the design discussion ────────────
const COBRANZA_URGENT_DAYS_BEFORE     = 1   // ≤1 day → urgente
const COBRANZA_IMPORTANT_DAYS_BEFORE  = 5   // 2-5 days → importante
const COBRANZA_UPCOMING_DAYS_BEFORE   = 7   // 6-7 days → proximo

// ── Thresholds (aumento) ───────────────────────────────────────────────────
const AUMENTO_URGENT_DAYS_BEFORE      = 3
const AUMENTO_IMPORTANT_DAYS_BEFORE   = 7
const AUMENTO_UPCOMING_DAYS_BEFORE    = 30

// ── Thresholds (contract end_date) ─────────────────────────────────────────
const CONTRACT_UPCOMING_DAYS_BEFORE   = 30
const CONTRACT_REVIEW_DAYS_BEFORE     = 60

// ── Workflow ───────────────────────────────────────────────────────────────
const ENVIADA_FOLLOWUP_DAYS           = 7   // 'enviada' > N days → follow up

const CADENCE_MONTHS: Record<string, number> = {
  mensual: 1, bimestral: 2, trimestral: 3,
  cuatrimestral: 4, semestral: 6, anual: 12,
}

function nextAdjustmentDate(startDate: string, cadence: string, today: Date): Date | null {
  const months = CADENCE_MONTHS[cadence]
  if (!months) return null
  const next = new Date(startDate)
  let safety = 1000
  while (next <= today && safety-- > 0) next.setMonth(next.getMonth() + months)
  return safety > 0 ? next : null
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / 86400000)
}

export async function getPendientesDigest(): Promise<PendienteDigest> {
  const period   = getCurrentPeriod()
  const supabase = await createSupabaseServer()
  const today    = new Date()

  // Two parallel queries:
  //   1. The grid query — gives us validation issues, status, transferencia,
  //      ingresos, contract identity. This is the heart of the digest.
  //   2. A targeted contract query — gives us payment_day, end_date, cadence,
  //      start_date, plus the tenant's phone for the WhatsApp action button.
  const [gridRows, contractsRes] = await Promise.all([
    getLiquidacionGridForPeriod(period),
    supabase
      .from('contracts')
      .select(`
        id, payment_day, end_date, start_date, cadence,
        contract_tenants(is_primary, tenants(name, phone)),
        contract_landlords(ownership_pct, landlords(name, email))
      `)
      .eq('status', 'active'),
  ])

  // Index contracts by id for O(1) lookup while iterating grid rows.
  const contractById = new Map<string, any>()
  for (const c of (contractsRes.data ?? []) as any[]) {
    contractById.set(c.id, c)
  }

  const items: PendienteItem[] = []

  for (const row of gridRows) {
    const c = contractById.get(row.contractId)
    if (!c) continue

    const tenant   = c.contract_tenants?.find((ct: any) => ct.is_primary) ?? c.contract_tenants?.[0]
    const landlord = (c.contract_landlords ?? [])
      .slice()
      .sort((a: any, b: any) => Number(b.ownership_pct) - Number(a.ownership_pct))[0]
    const tenantPhone   = tenant?.tenants?.phone   ?? null
    const landlordEmail = landlord?.landlords?.email ?? null

    const base = {
      contractId:   row.contractId,
      landlordName: row.propietario,
      tenantName:   row.inquilino,
      tenantPhone,
      landlordEmail,
    }

    // ── Stream 1: COBRANZAS ─────────────────────────────────────────────
    addCobranzaSignals(items, row, c, base, today, period)

    // ── Stream 2: AUMENTOS ──────────────────────────────────────────────
    addAumentoSignals(items, c, base, today)

    // ── Stream 3: VALIDACIÓN — direct integration with Phase 7A ─────────
    addValidationSignals(items, row, base)

    // ── Stream 4: WORKFLOW (liquidación status anomalies) ───────────────
    addWorkflowSignals(items, row, base)

    // ── Stream 5: CONTRATO LIFECYCLE ────────────────────────────────────
    addContractLifecycleSignals(items, c, base, today)

    // ── Stream 6: DATOS (hygiene) ───────────────────────────────────────
    addDataHygieneSignals(items, base, tenantPhone, landlordEmail)
  }

  // Sort: severity (urgent first), then daysContext (most urgent first).
  const sevOrder: Record<Severity, number> = { urgente: 0, importante: 1, proximo: 2, aviso: 3 }
  items.sort((a, b) => {
    const cmp = sevOrder[a.severity] - sevOrder[b.severity]
    if (cmp !== 0) return cmp
    return (a.daysContext ?? 9999) - (b.daysContext ?? 9999)
  })

  const counts: PendienteCounts = {
    urgente:    items.filter(i => i.severity === 'urgente').length,
    importante: items.filter(i => i.severity === 'importante').length,
    proximo:    items.filter(i => i.severity === 'proximo').length,
    aviso:      items.filter(i => i.severity === 'aviso').length,
    total:      items.length,
  }

  return { items, counts, period }
}

// ════════════════════════════════════════════════════════════════════════════
// Stream implementations — kept pure & readable. Each pushes 0+ items.
// ════════════════════════════════════════════════════════════════════════════

function addCobranzaSignals(
  items: PendienteItem[],
  row:   LiquidacionGridRow,
  c:     any,
  base:  Omit<PendienteItem, 'id' | 'severity' | 'type' | 'title' | 'detail' | 'daysContext' | 'amount' | 'issueCount'>,
  today: Date,
  period: string,
) {
  // Skip if already paid.
  if (row.ingresos > 0 && row.deuda <= 0) return

  const paymentDay = Number(c.payment_day ?? 5)
  if (!isFinite(paymentDay)) return

  // Period is YYYY-MM-01. Compute the due date IN that period:
  //   dueDate = YYYY-MM-paymentDay (clamped to last day of month).
  const [y, m] = period.split('-')
  const year  = Number(y)
  const month = Number(m)
  const lastDay = new Date(year, month, 0).getDate()
  const day = Math.min(paymentDay, lastDay)
  const dueDate = new Date(year, month - 1, day)

  const days = daysBetween(today, dueDate)
  let severity: Severity | null = null
  let label   = ''

  if (days < 0) {
    severity = 'urgente'
    label    = `Vencido hace ${Math.abs(days)} ${Math.abs(days) === 1 ? 'día' : 'días'}`
  } else if (days <= COBRANZA_URGENT_DAYS_BEFORE) {
    severity = 'urgente'
    label    = days === 0 ? 'Vence hoy' : 'Vence mañana'
  } else if (days <= COBRANZA_IMPORTANT_DAYS_BEFORE) {
    severity = 'importante'
    label    = `Vence en ${days} días`
  } else if (days <= COBRANZA_UPCOMING_DAYS_BEFORE) {
    severity = 'proximo'
    label    = `Vence en ${days} días`
  }
  if (!severity) return

  items.push({
    id:         `${row.contractId}-cobranza`,
    severity,
    type:       'cobranza',
    ...base,
    title:      `Cobranza ${row.deuda > 0 ? 'pendiente' : 'a vencer'}`,
    detail:     `${label} · alquiler ${row.currentRent > 0 ? formatPesos(row.currentRent) : 's/d'}${row.deuda > 0 ? ` · saldo ${formatPesos(row.deuda)}` : ''}`,
    daysContext: days,
    amount:      row.deuda > 0 ? row.deuda : row.currentRent,
    issueCount:  null,
  })
}

function addAumentoSignals(
  items: PendienteItem[],
  c:     any,
  base:  Omit<PendienteItem, 'id' | 'severity' | 'type' | 'title' | 'detail' | 'daysContext' | 'amount' | 'issueCount'>,
  today: Date,
) {
  if (!c.start_date || !c.cadence) return
  const next = nextAdjustmentDate(c.start_date, c.cadence, today)
  if (!next) return

  const days = daysBetween(today, next)
  let severity: Severity | null = null
  let label    = ''

  if (days < 0) {
    severity = 'urgente'
    label    = `Aumento vencido hace ${Math.abs(days)} ${Math.abs(days) === 1 ? 'día' : 'días'} sin aplicar`
  } else if (days <= AUMENTO_URGENT_DAYS_BEFORE) {
    severity = 'importante'   // not urgent — adjustment can be applied calmly
    label    = days === 0 ? 'Aumento aplica hoy' : `Aumento en ${days} ${days === 1 ? 'día' : 'días'}`
  } else if (days <= AUMENTO_IMPORTANT_DAYS_BEFORE) {
    severity = 'importante'
    label    = `Aumento en ${days} días`
  } else if (days <= AUMENTO_UPCOMING_DAYS_BEFORE) {
    severity = 'proximo'
    label    = `Aumento en ${days} días`
  }
  if (!severity) return

  items.push({
    id:          `${base.contractId}-aumento`,
    severity,
    type:        'aumento',
    ...base,
    title:       'Aviso de aumento',
    detail:      label,
    daysContext: days,
    amount:      null,
    issueCount:  null,
  })
}

function addValidationSignals(
  items: PendienteItem[],
  row:   LiquidacionGridRow,
  base:  Omit<PendienteItem, 'id' | 'severity' | 'type' | 'title' | 'detail' | 'daysContext' | 'amount' | 'issueCount'>,
) {
  if (row.validationIssues.length === 0) return

  const errors   = row.validationIssues.filter(i => i.severity === 'error')
  const warnings = row.validationIssues.filter(i => i.severity === 'warning')

  // ROLL UP per row (my recommendation that user approved). One item with
  // the count + a concise summary; the encargada clicks through to the
  // grid to fix everything at once.
  if (errors.length > 0) {
    items.push({
      id:          `${row.contractId}-val-error`,
      severity:    'urgente',
      type:        'validacion',
      ...base,
      title:       `${errors.length} error${errors.length === 1 ? '' : 'es'} de validación`,
      detail:      errors.map(e => e.message).join(' · '),
      daysContext: null,
      amount:      null,
      issueCount:  errors.length,
    })
  }
  if (warnings.length > 0 && errors.length === 0) {
    // Only surface warnings if there are no errors on this row — otherwise
    // the error item is enough; the encargada will see both when she opens
    // the Check popover in the grid.
    items.push({
      id:          `${row.contractId}-val-warn`,
      severity:    'aviso',
      type:        'validacion',
      ...base,
      title:       `${warnings.length} aviso${warnings.length === 1 ? '' : 's'} de validación`,
      detail:      warnings.map(w => w.message).join(' · '),
      daysContext: null,
      amount:      null,
      issueCount:  warnings.length,
    })
  }
}

function addWorkflowSignals(
  items: PendienteItem[],
  row:   LiquidacionGridRow,
  base:  Omit<PendienteItem, 'id' | 'severity' | 'type' | 'title' | 'detail' | 'daysContext' | 'amount' | 'issueCount'>,
) {
  // a) Cobrado completo, transferencia ya hecha, pero status sigue en
  //    'borrador' → liquidación está lista para mandar al propietario.
  if (
    row.status === 'draft' &&
    row.ingresos > 0 &&
    row.deuda <= 0 &&
    row.transferencia > 0
  ) {
    items.push({
      id:          `${row.contractId}-wf-listo`,
      severity:    'importante',
      type:        'workflow',
      ...base,
      title:       'Liquidación lista para enviar',
      detail:      `Cobrado, comisión calculada y transferencia hecha — falta mandar el mail al propietario.`,
      daysContext: null,
      amount:      row.transferencia,
      issueCount:  null,
    })
  }

  // b) status === 'sent' & sent_at > N days ago → seguimiento.
  if (row.status === 'sent' && row.sentAt) {
    const sentAt = new Date(row.sentAt)
    const daysSince = Math.floor((Date.now() - sentAt.getTime()) / 86400000)
    if (daysSince >= ENVIADA_FOLLOWUP_DAYS) {
      items.push({
        id:          `${row.contractId}-wf-seguimiento`,
        severity:    'proximo',
        type:        'workflow',
        ...base,
        title:       'Liquidación enviada sin pasar a pagada',
        detail:      `Enviada hace ${daysSince} días — confirmá si ya pagaste al propietario y marcala como pagada.`,
        daysContext: daysSince,
        amount:      row.transferencia,
        issueCount:  null,
      })
    }
  }
}

function addContractLifecycleSignals(
  items: PendienteItem[],
  c:     any,
  base:  Omit<PendienteItem, 'id' | 'severity' | 'type' | 'title' | 'detail' | 'daysContext' | 'amount' | 'issueCount'>,
  today: Date,
) {
  if (!c.end_date) return
  const end  = new Date(c.end_date)
  const days = daysBetween(today, end)

  let severity: Severity | null = null
  let label    = ''
  if (days < 0) {
    severity = 'urgente'
    label    = `Contrato vencido hace ${Math.abs(days)} días — revisá renovación o rescisión`
  } else if (days <= CONTRACT_UPCOMING_DAYS_BEFORE) {
    severity = 'proximo'
    label    = `Contrato vence en ${days} días`
  } else if (days <= CONTRACT_REVIEW_DAYS_BEFORE) {
    severity = 'aviso'
    label    = `Contrato vence en ${days} días`
  }
  if (!severity) return

  items.push({
    id:          `${base.contractId}-contrato`,
    severity,
    type:        'contrato',
    ...base,
    title:       'Vigencia próxima a vencer',
    detail:      label,
    daysContext: days,
    amount:      null,
    issueCount:  null,
  })
}

function addDataHygieneSignals(
  items:         PendienteItem[],
  base:          Omit<PendienteItem, 'id' | 'severity' | 'type' | 'title' | 'detail' | 'daysContext' | 'amount' | 'issueCount'>,
  tenantPhone:   string | null,
  landlordEmail: string | null,
) {
  if (!landlordEmail) {
    items.push({
      id:          `${base.contractId}-datos-emailprop`,
      severity:    'aviso',
      type:        'datos',
      ...base,
      title:       'Propietario sin email',
      detail:      'No vas a poder mandarle la liquidación por mail hasta que cargues el email.',
      daysContext: null,
      amount:      null,
      issueCount:  null,
    })
  }
  if (!tenantPhone) {
    items.push({
      id:          `${base.contractId}-datos-telinq`,
      severity:    'aviso',
      type:        'datos',
      ...base,
      title:       'Inquilino sin teléfono',
      detail:      'Sin teléfono no podés mandarle recordatorios por WhatsApp.',
      daysContext: null,
      amount:      null,
      issueCount:  null,
    })
  }
}

// ── Lightweight money formatter — local to this module to avoid pulling
//    the full @/lib/format into a server-only query module. */
function formatPesos(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-AR')
}
