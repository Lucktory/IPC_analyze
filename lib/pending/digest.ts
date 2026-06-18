// ============================================================================
// Pendientes digest — focused cashflow inbox (2026-06-18 redesign).
//
// /pendientes is now a three-category list driven entirely by where each
// contract sits in the cobranza → transferencia → pagada workflow:
//
//   1. cobranza_proxima        — rent due in ≤7 days, no RENT_IN yet
//   2. pendiente_transferencia — overdue OR cobrado-but-not-transferido
//                                  · subcase falta_cobro: tenant hasn't paid
//                                  · subcase falta_transferencia: agency owes the landlord
//   3. liquidacion_abierta     — LANDLORD_PAYOUT recorded, status !== 'paid'
//
// Removed from this page: aumento, contract end-date, validation rollups,
// data hygiene. Those signals live closer to the data they refer to
// (planilla Check column, contract detail page, /propietarios). Keeping
// /pendientes narrowly focused makes the bell badge mean something.
//
// Single source of truth: every item is derived from the same row builder
// the planilla uses (getLiquidacionGridForPeriod), so the encargada never
// sees two pages disagree about what's pending.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import { getCurrentPeriod } from '@/lib/period'
import { getLiquidacionGridForPeriod } from '@/lib/liquidacion/queries'

export type PendienteCategory =
  | 'cobranza_proxima'
  | 'pendiente_transferencia'
  | 'liquidacion_abierta'

/** Sub-state inside `pendiente_transferencia` — drives WHO we contact
 *  (tenant vs landlord) and what the action template says. */
export type TransferenciaSubcase = 'falta_cobro' | 'falta_transferencia'

export interface PendienteItem {
  id:            string
  category:      PendienteCategory
  /** Sub-state for category 2. Null on categories 1 and 3. */
  subcase:       TransferenciaSubcase | null
  contractId:    string
  landlordName:  string
  landlordEmail: string | null
  tenantName:    string
  tenantPhone:   string | null
  tenantEmail:   string | null
  /** Days context: negative = overdue, positive = upcoming, null = N/A. */
  days:          number | null
  /** Pesos value relevant to this item — rent / saldo a rendir. */
  amount:        number | null
  /** Short Spanish phrase rendered in the row. */
  detail:        string
}

export interface PendienteCounts {
  cobranza_proxima:        number
  pendiente_transferencia: number
  liquidacion_abierta:     number
  total:                   number
}

export interface PendienteDigest {
  items:  PendienteItem[]
  counts: PendienteCounts
  period: string
}

const COBRANZA_PROXIMA_DAYS = 7

export async function getPendientesDigest(): Promise<PendienteDigest> {
  const period   = getCurrentPeriod()
  const supabase = await createSupabaseServer()

  const [gridRows, contractsRes] = await Promise.all([
    getLiquidacionGridForPeriod(period),
    supabase
      .from('contracts')
      .select(`
        id,
        contract_tenants(is_primary, tenants(name, phone, email)),
        contract_landlords(ownership_pct, landlords(name, email))
      `)
      .eq('status', 'active'),
  ])

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

    const base = {
      contractId:    row.contractId,
      landlordName:  row.propietario,
      landlordEmail: landlord?.landlords?.email ?? null,
      tenantName:    row.inquilino,
      tenantPhone:   tenant?.tenants?.phone ?? null,
      tenantEmail:   tenant?.tenants?.email ?? null,
    }

    const cobrado     = !!row.fechaBanco
    const transferido = !!row.diaTransf
    const paid        = row.status === 'paid'

    // ── Category 3: LANDLORD_PAYOUT recorded but status still not 'paid'.
    //    The bank transfer is done; the encargada just needs to flip the
    //    liquidación to 'paid' (or send the landlord a confirmation).
    if (transferido && !paid) {
      items.push({
        id:        `${row.contractId}-cat3`,
        category:  'liquidacion_abierta',
        subcase:   null,
        ...base,
        days:      null,
        amount:    row.transferencia,
        detail:    `Transferencia hecha el ${formatDayMonth(row.diaTransf!)} — falta marcar la liquidación como pagada.`,
      })
      continue
    }

    // ── Category 2b: rent collected but no LANDLORD_PAYOUT.
    //    The agency owes the landlord — chase the bank transfer.
    if (cobrado && !transferido) {
      items.push({
        id:        `${row.contractId}-cat2b`,
        category:  'pendiente_transferencia',
        subcase:   'falta_transferencia',
        ...base,
        days:      null,
        amount:    row.transferencia,
        detail:    `Cobrado el ${formatDayMonth(row.fechaBanco!)} — falta transferir ${formatPesos(row.transferencia)} al propietario.`,
      })
      continue
    }

    // ── Category 2a: rent overdue and no RENT_IN.
    //    Chase the tenant.
    if (!cobrado && row.daysUntilPayment != null && row.daysUntilPayment < 0) {
      const daysLate = -row.daysUntilPayment
      items.push({
        id:        `${row.contractId}-cat2a`,
        category:  'pendiente_transferencia',
        subcase:   'falta_cobro',
        ...base,
        days:      row.daysUntilPayment,
        amount:    row.currentRent,
        detail:    `Alquiler vencido hace ${daysLate} ${daysLate === 1 ? 'día' : 'días'} — sin cobro registrado.`,
      })
      continue
    }

    // ── Category 1: due in ≤7 days, not collected yet. Informational
    //    nudge so the encargada can send a friendly reminder.
    if (
      !cobrado &&
      row.daysUntilPayment != null &&
      row.daysUntilPayment >= 0 &&
      row.daysUntilPayment <= COBRANZA_PROXIMA_DAYS
    ) {
      const d = row.daysUntilPayment
      const label = d === 0 ? 'Vence hoy'
                  : d === 1 ? 'Vence mañana'
                  : `Vence en ${d} días`
      items.push({
        id:        `${row.contractId}-cat1`,
        category:  'cobranza_proxima',
        subcase:   null,
        ...base,
        days:      d,
        amount:    row.currentRent,
        detail:    `${label} — alquiler ${formatPesos(row.currentRent)}.`,
      })
      continue
    }
  }

  // Sort: most-actionable category first, then by urgency (oldest overdue
  // → newest within the same category).
  const CATEGORY_ORDER: Record<PendienteCategory, number> = {
    pendiente_transferencia: 0,
    liquidacion_abierta:     1,
    cobranza_proxima:        2,
  }
  items.sort((a, b) => {
    const cmp = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]
    if (cmp !== 0) return cmp
    return (a.days ?? 9999) - (b.days ?? 9999)
  })

  const counts: PendienteCounts = {
    cobranza_proxima:        items.filter(i => i.category === 'cobranza_proxima').length,
    pendiente_transferencia: items.filter(i => i.category === 'pendiente_transferencia').length,
    liquidacion_abierta:     items.filter(i => i.category === 'liquidacion_abierta').length,
    total:                   items.length,
  }

  return { items, counts, period }
}

/**
 * Bell-badge count for the topbar. Counts the two ACTIONABLE categories
 * (pendiente_transferencia + liquidacion_abierta). cobranza_proxima is
 * informational ("rent due in 5 days") so it doesn't bump the bell.
 */
export async function getPendingCount(): Promise<number> {
  const { counts } = await getPendientesDigest()
  return counts.pendiente_transferencia + counts.liquidacion_abierta
}

function formatPesos(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-AR')
}

function formatDayMonth(iso: string): string {
  // YYYY-MM-DD → DD/MM
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}
