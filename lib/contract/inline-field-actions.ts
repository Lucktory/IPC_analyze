'use server'

// ============================================================================
// Inline contract-field updates — fired by the in-cell editors on the
// /liquidacion planilla. One action per single field, each returns the
// standard { ok, error } shape.
//
// Why field-by-field instead of a generic "update contract" action: the
// planilla edits one column at a time. Generic patches would force the
// caller to assemble a partial payload and the server to whitelist keys.
// Per-field is simpler, validated, and crystal clear about intent.
// ============================================================================

import { revalidatePath } from 'next/cache'
import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure } from '@/lib/db-errors'
import { normalizeLfa } from '@/lib/contract/lfa'
import { buildCommissionMarker } from '@/lib/bancos/destination'
import { CADENCE_MONTHS, nextAdjustmentDate, pendingAdjustment, aumentoWindow, computeAumento, scaleRentByFactor } from '@/lib/contract/aumento'
import { getIpcIndexMap } from '@/lib/ipc/queries'
import { getCurrentPeriod } from '@/lib/period'

export interface InlineResult {
  ok:    boolean
  error: string | null
}

function revalidate(contractId: string) {
  revalidatePath('/liquidacion')
  revalidatePath(`/contratos/${contractId}`)
}

// ── LFA code ────────────────────────────────────────────────────────────────
export async function updateContractLfa(contractId: string, lfa: string | null): Promise<InlineResult> {
  const supabase = await createSupabaseServer()
  const norm = normalizeLfa(lfa)
  if (!norm.ok) return { ok: false, error: norm.error }
  const { error } = await supabase.from('contracts').update({ lfa_code: norm.value }).eq('id', contractId)
  if (error) return dbFailure(error)
  revalidate(contractId)
  return { ok: true, error: null }
}

// ── Expensas (monthly charge — separate from rent) ──────────────────────────
export async function updateContractExpensas(contractId: string, expensas: number): Promise<InlineResult> {
  if (!isFinite(expensas) || expensas < 0) {
    return { ok: false, error: 'Las expensas deben ser un número ≥ 0.' }
  }
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('contracts').update({ expensas }).eq('id', contractId)
  if (error) return dbFailure(error)
  revalidate(contractId)
  return { ok: true, error: null }
}

// ── Commission % (Pampa's cut on total cobrado) ─────────────────────────────
export async function updateContractCommissionPct(contractId: string, pct: number): Promise<InlineResult> {
  if (!isFinite(pct) || pct < 0 || pct > 100) {
    return { ok: false, error: 'La comisión debe estar entre 0 y 100.' }
  }
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('contracts').update({ commission_pct: pct }).eq('id', contractId)
  if (error) return dbFailure(error)
  revalidate(contractId)
  return { ok: true, error: null }
}

// ── Commission includes IVA (drives the IVA column on the planilla) ─────────
// True when the invoicing administrator is RI (adds 21% IVA on the commission
// invoice); false for Monotributo. Per-contract flag because Alejandro picks
// the invoicer per contract depending on what the landlord prefers.
export async function updateContractCommissionIncludesIva(
  contractId: string,
  includesIva: boolean,
  /** When provided, re-sync THAT period's commission so the recorded ADMI
   *  matches the new IVA setting in one action — otherwise the toggle only
   *  changes the display and the recorded commission stays stale until the
   *  encargada clicks Calcular. Only re-generates when a COMMISSION_OUT
   *  already exists for the period (never creates one here). */
  period?: string,
): Promise<InlineResult> {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('contracts')
    .update({ commission_includes_iva: includesIva })
    .eq('id', contractId)
  if (error) return dbFailure(error)

  if (period && /^\d{4}-\d{2}-01$/.test(period)) {
    // Recompute the recorded ADMI with the new IVA factor — the shared reflex
    // (creates if missing, recomputes if present, preserves the bank).
    const { syncCommissionForPeriod } = await import('@/lib/transaction/actions')
    await syncCommissionForPeriod(contractId, period)
  }

  revalidate(contractId)
  return { ok: true, error: null }
}

// (The 2026-06-19 updateContractAblSurcharge action was removed on
// 2026-06-20 along with the contracts.includes_abl / abl_amount columns.
// Recurring charges now live in `contract_recurring_charges` with N rows
// per contract — see lib/contract/recurring-charges.ts for the CRUD.)

// ── Aplicar aumento — persistence shared by the IPC and manual paths ─────────
// For a two-part contract (facturado + N/F) the same factor scales each part
// independently; IVA re-derives from rent_iva_rate. Sets last_adjustment_date to
// the EFFECTIVE period (not the click date), advances next_adjustment_date, and
// writes a COMPLETE adjustments audit row (with cadence_used — previously omitted,
// which silently failed the insert against the NOT NULL column).
interface PersistAumentoArgs {
  oldRent:       number
  newRent:       number
  newNeto:       number | null
  newNf:         number | null
  factor:        number
  cpiValues:     unknown        // provenance snapshot (jsonb)
  formula:       'compound' | 'manual'
  cadence:       string
  startDate:     string
  effectiveDate: string         // 'YYYY-MM-DD' the aumento takes effect
}

async function persistAumento(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  contractId: string,
  p: PersistAumentoArgs,
): Promise<InlineResult> {
  const nextAdj = nextAdjustmentDate(p.startDate, p.cadence, new Date(p.effectiveDate))
  const update: Record<string, unknown> = {
    current_rent:         p.newRent,
    last_adjustment_date: p.effectiveDate,
    next_adjustment_date: nextAdj ? nextAdj.toISOString().slice(0, 10) : null,
  }
  if (p.newNeto != null) {
    update.rent_facturado_neto = p.newNeto
    update.rent_no_facturado   = p.newNf
  }

  const { error: upErr } = await supabase.from('contracts').update(update).eq('id', contractId)
  if (upErr) return dbFailure(upErr)

  // Best-effort audit row — a failed insert must not undo the applied aumento.
  const { error: adjErr } = await supabase.from('adjustments').insert({
    contract_id:  contractId,
    applied_at:   new Date().toISOString().slice(0, 10),
    old_rent:     p.oldRent,
    new_rent:     p.newRent,
    factor:       Math.round(p.factor * 1e6) / 1e6,
    cpi_values:   p.cpiValues,
    formula:      p.formula,
    cadence_used: p.cadence,
  })
  if (adjErr) console.warn('[persistAumento] adjustment audit insert failed:', adjErr.message)

  revalidate(contractId)
  return { ok: true, error: null }
}

// ── Cadencia (how often the rent adjusts) — the aumento window depends on it,
// so a wrong value (e.g. the Bustos import defaulted to trimestral) computes the
// wrong increase. Editable so the encargada can correct it.
export async function updateContractCadence(contractId: string, cadence: string): Promise<InlineResult> {
  if (!CADENCE_MONTHS[cadence]) return { ok: false, error: 'Cadencia inválida.' }
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('contracts')
    .update({ cadence, updated_at: new Date().toISOString() })
    .eq('id', contractId)
  if (error) return dbFailure(error)
  revalidate(contractId)
  revalidatePath('/diagnostico')
  return { ok: true, error: null }
}

// ── Aplicar aumento IPC (automatic) — computes the factor from stored INDEC
// index levels for the contract's cadence (window = N months ending at M-2).
export async function applyIpcAumento(contractId: string, effectivePeriod: string): Promise<InlineResult> {
  if (!/^\d{4}-\d{2}-01$/.test(effectivePeriod)) return { ok: false, error: 'Período inválido.' }
  const supabase = await createSupabaseServer()
  const { data: c, error: cErr } = await supabase
    .from('contracts')
    .select('current_rent, rent_facturado_neto, rent_no_facturado, rent_iva_rate, cadence, start_date, last_adjustment_date')
    .eq('id', contractId)
    .maybeSingle()
  if (cErr) return dbFailure(cErr)
  if (!c) return { ok: false, error: 'Contrato no encontrado.' }

  const cadence   = (c as any).cadence as string
  const startDate = (c as any).start_date as string

  // Idempotency + correct effective date: recompute the earliest UNAPPLIED
  // scheduled adjustment. Null → already applied / nothing due → no-op (so a
  // second click, or the panel re-rendering after refresh, can't double-apply).
  const eff = pendingAdjustment(startDate, cadence, (c as any).last_adjustment_date ?? null, new Date())
  if (!eff) return { ok: true, error: null }
  const effMonth = `${eff.getUTCFullYear()}-${String(eff.getUTCMonth() + 1).padStart(2, '0')}`
  if (effMonth !== effectivePeriod.slice(0, 7)) {
    return { ok: false, error: 'El aumento pendiente cambió. Recargá la página e intentá de nuevo.' }
  }
  const effIso = eff.toISOString().slice(0, 10)   // real scheduled date (carries the day)

  const win = aumentoWindow(`${effMonth}-01`, cadence)
  if (!win) return { ok: false, error: 'Cadencia inválida.' }

  const indexByMonth = await getIpcIndexMap([win.numeratorMonth, win.denominatorMonth])
  const result = computeAumento({
    currentRent:       Number((c as any).current_rent ?? 0),
    rentFacturadoNeto: (c as any).rent_facturado_neto != null ? Number((c as any).rent_facturado_neto) : null,
    rentNoFacturado:   Number((c as any).rent_no_facturado ?? 0),
    rentIvaRate:       Number((c as any).rent_iva_rate ?? 0),
    cadence, effectivePeriod: `${effMonth}-01`, indexByMonth,
  })
  if (!result) return { ok: false, error: 'Cadencia inválida.' }
  if (result.missingMonths.length) {
    return { ok: false, error: `Falta el IPC de ${result.missingMonths.join(', ')}. Actualizá el IPC antes de aplicar.` }
  }

  return persistAumento(supabase, contractId, {
    oldRent:  Number((c as any).current_rent ?? 0),
    newRent:  result.newRent,
    newNeto:  result.newNeto,
    newNf:    result.newNf,
    factor:   result.factor,
    cpiValues: {
      source: 'INDEC', series: '148.3_INIVELNAL_DICI_M_26',
      window: win.months, index_start_month: win.denominatorMonth, index_start: result.indexStart,
      index_end_month: win.numeratorMonth, index_end: result.indexEnd, pct: result.pct,
    },
    formula: 'compound', cadence, startDate, effectiveDate: effIso,
  })
}

// ── Aplicar aumento manual — override the IPC with either a hand-entered % or a
// target amount ("queda en $X"). Both funnel through applyManualAumento so the
// factor→rent math (scaleRentByFactor) and the persistence (persistAumento) live
// ONCE — no duplicated commission/aumento logic. Effective FROM the current
// month, NEVER retroactive: per Alejandro he pausa el aumento pautado y aplica su
// propio valor cuando lo cierra con el inquilino, así arranca el mes que lo carga.
type ManualAumentoSpec = { kind: 'pct'; pct: number } | { kind: 'amount'; amount: number }

async function applyManualAumento(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  contractId: string,
  spec: ManualAumentoSpec,
): Promise<InlineResult> {
  const { data: c, error: cErr } = await supabase
    .from('contracts')
    .select('current_rent, rent_facturado_neto, rent_no_facturado, rent_iva_rate, cadence, start_date')
    .eq('id', contractId)
    .maybeSingle()
  if (cErr) return dbFailure(cErr)
  if (!c) return { ok: false, error: 'Contrato no encontrado.' }

  const cadence = (c as any).cadence as string
  if (!CADENCE_MONTHS[cadence]) return { ok: false, error: 'La cadencia del contrato es inválida.' }
  const oldRent = Number((c as any).current_rent ?? 0)

  // The only thing the two manual paths differ on: how the factor is derived.
  let factor: number
  let cpiValues: Record<string, unknown>
  if (spec.kind === 'pct') {
    if (!isFinite(spec.pct) || spec.pct <= -100) return { ok: false, error: 'El porcentaje de aumento es inválido.' }
    factor = 1 + spec.pct / 100
    cpiValues = { manual_pct: spec.pct }
  } else {
    if (!isFinite(spec.amount) || spec.amount <= 0) return { ok: false, error: 'El monto del alquiler debe ser mayor a 0.' }
    if (oldRent <= 0) return { ok: false, error: 'El contrato no tiene un alquiler base para calcular el aumento.' }
    factor = spec.amount / oldRent
    cpiValues = { manual_amount: spec.amount }
  }

  const { newRent, newNeto, newNf } = scaleRentByFactor(
    oldRent,
    (c as any).rent_facturado_neto != null ? Number((c as any).rent_facturado_neto) : null,
    Number((c as any).rent_no_facturado ?? 0),
    Number((c as any).rent_iva_rate ?? 0),
    factor,
  )

  return persistAumento(supabase, contractId, {
    oldRent, newRent, newNeto, newNf, factor,
    cpiValues, formula: 'manual', cadence,
    startDate:     (c as any).start_date as string,
    effectiveDate: getCurrentPeriod(),   // 'YYYY-MM-01' — de ahí en adelante, no retroactivo
  })
}

export async function applyContractAumento(contractId: string, pct: number): Promise<InlineResult> {
  const supabase = await createSupabaseServer()
  return applyManualAumento(supabase, contractId, { kind: 'pct', pct })
}

export async function applyContractAumentoAmount(contractId: string, amount: number): Promise<InlineResult> {
  const supabase = await createSupabaseServer()
  return applyManualAumento(supabase, contractId, { kind: 'amount', amount })
}

// ── Vigencia (start_date / end_date) ────────────────────────────────────────
export async function updateContractVigencia(
  contractId: string,
  startDate:  string | null,
  endDate:    string | null,
): Promise<InlineResult> {
  if (startDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, error: 'Fecha de inicio inválida.' }
  }
  if (endDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { ok: false, error: 'Fecha de fin inválida.' }
  }
  if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
    return { ok: false, error: 'La fecha de fin debe ser posterior al inicio.' }
  }
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('contracts')
    .update({ start_date: startDate, end_date: endDate })
    .eq('id', contractId)
  if (error) return dbFailure(error)
  revalidate(contractId)
  return { ok: true, error: null }
}

// ── Rescindir / reactivar contrato ──────────────────────────────────────────
// Alejandro: "A veces puedo perder una propiedad — porque el dueño se la quiere
// llevar, o porque yo no la quiero tener mas." Rescindir flips the contract to
// 'rescinded': it drops off the active planilla, the dashboard counts it as
// rescinded, and the "Rescindido" badge shows on the detail + list. Fully
// reversible via reactivar (status back to 'active'). The vigencia end_date is
// left untouched so reactivar is a clean undo — the exact termination date, if
// the office wants to record it, is set with the existing vigencia editor.
const CONTRACT_STATUS = { ACTIVE: 'active', RESCINDED: 'rescinded' } as const

// Status changes ripple beyond the two paths `revalidate` covers: the contract
// leaves/returns to the /liquidacion planilla, the /contratos list, and the
// /dashboard counts. Revalidate all four so no stale view lingers.
function revalidateStatus(contractId: string) {
  revalidatePath('/liquidacion')
  revalidatePath('/contratos')
  revalidatePath(`/contratos/${contractId}`)
  revalidatePath('/dashboard')
}

export async function rescindContract(contractId: string): Promise<InlineResult> {
  const supabase = await createSupabaseServer()
  const { data: existing, error: readErr } = await supabase
    .from('contracts').select('status').eq('id', contractId).maybeSingle()
  if (readErr) return dbFailure(readErr)
  if (!existing) return { ok: false, error: 'No se encontró el contrato.' }
  if ((existing as { status: string }).status === CONTRACT_STATUS.RESCINDED) {
    return { ok: true, error: null }   // already rescinded — idempotent
  }
  const { error } = await supabase
    .from('contracts').update({ status: CONTRACT_STATUS.RESCINDED }).eq('id', contractId)
  if (error) return dbFailure(error)
  revalidateStatus(contractId)
  return { ok: true, error: null }
}

export async function reactivateContract(contractId: string): Promise<InlineResult> {
  const supabase = await createSupabaseServer()
  const { data: existing, error: readErr } = await supabase
    .from('contracts').select('status').eq('id', contractId).maybeSingle()
  if (readErr) return dbFailure(readErr)
  if (!existing) return { ok: false, error: 'No se encontró el contrato.' }
  // Only a rescinded contract needs reactivar. Guarding avoids silently flipping
  // an ended/draft/suspended contract to active (mirrors rescindContract).
  if ((existing as { status: string }).status !== CONTRACT_STATUS.RESCINDED) {
    return { ok: true, error: null }
  }
  const { error } = await supabase
    .from('contracts').update({ status: CONTRACT_STATUS.ACTIVE }).eq('id', contractId)
  if (error) return dbFailure(error)
  revalidateStatus(contractId)
  return { ok: true, error: null }
}

// ============================================================================
// Per-cell transaction upsert.
//
// The encargada types a value into a money cell (Ingresos / Otros / one of
// the three ADM destinations). The system needs to either create a new
// transaction or update the existing one for that (contract, period, type).
//
// Idempotent: matches the existing transaction by (contract_id, period,
// transaction_type_id [+ description marker for destination]) and updates
// the amount in place. Otherwise inserts a fresh row.
// ============================================================================

export type DestinationCode = 'ADM_GALICIA' | 'ADM_FRANCES_50_9' | 'ADM_FRANCES_51_6' | null

export async function upsertCellTransaction(
  contractId:  string,
  period:      string,           // YYYY-MM-01
  typeCode:    string,           // 'RENT_IN' | 'OTHER_OUT' | 'COMMISSION_OUT' | 'LANDLORD_PAYOUT'
  amount:      number,
  bankDate:    string | null,
  description: string | null,
  destination: DestinationCode = null,
): Promise<InlineResult> {
  // Diagnostic log — surfaces every inline money-cell write in Vercel
  // runtime logs prefixed [CELL_TX] so a "didn't save" report can be
  // matched to a specific call.
  try {
    console.log(
      `[CELL_TX] upsertCellTransaction contract=${contractId} period=${period} ` +
      `type=${typeCode}${destination ? ` dest=${destination}` : ''} amount=${amount}`,
    )
  } catch { /* ignore */ }
  if (!isFinite(amount) || amount < 0) {
    return { ok: false, error: 'El monto debe ser un número ≥ 0.' }
  }
  if (bankDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(bankDate)) {
    return { ok: false, error: 'Fecha bancaria inválida.' }
  }

  const supabase = await createSupabaseServer()

  // Resolve transaction_type_id and administration_id.
  const [{ data: typeRow, error: typeErr }, { data: contract, error: contractErr }] = await Promise.all([
    supabase.from('transaction_types').select('id').eq('code', typeCode).maybeSingle(),
    supabase.from('contracts').select('administration_id').eq('id', contractId).maybeSingle(),
  ])
  if (typeErr) return dbFailure(typeErr)
  if (contractErr) return dbFailure(contractErr)
  if (!typeRow)  return { ok: false, error: `Tipo de transacción ${typeCode} no encontrado.` }
  if (!contract) return { ok: false, error: 'Contrato no encontrado.' }
  const typeId          = (typeRow  as any).id as string
  const administrationId = (contract as any).administration_id as string

  // Build the description for INSERT (only used when creating a new row).
  // For COMMISSION_OUT we append a destination marker (ADM_GALICIA / ...)
  // unless the caller's label already contains it — avoids the
  // double-suffix bug "Comisión → ADM_GALICIA · ADM_GALICIA" that came
  // from EditableTransactionCell sometimes passing a label that already
  // included the destination code.
  const baseDescription = (description ?? '').trim()
  let insertDescription: string | null = baseDescription || null
  if (destination) {
    insertDescription = baseDescription.includes(destination)
      ? (baseDescription || destination)
      : (baseDescription ? `${baseDescription}${buildCommissionMarker(destination)}` : destination)
  }

  // Find existing transaction for (contract, period, type [+ destination marker]).
  const { data: existing, error: findErr } = await supabase
    .from('transactions')
    .select('id, description')
    .eq('contract_id', contractId)
    .eq('period', period)
    .eq('transaction_type_id', typeId)
  if (findErr) return dbFailure(findErr)

  // For COMMISSION_OUT, match by destination marker; for others, the most
  // recent row for (contract, period, type) is "the" one we keep updated.
  let target: { id: string } | null = null
  if ((existing ?? []).length > 0) {
    if (destination) {
      target = ((existing ?? []) as any[]).find(t => (t.description ?? '').includes(destination)) ?? null
    } else {
      target = (existing as any[])[0] ?? null
    }
  }

  // If amount == 0 and a row exists, delete it (clean state).
  if (amount === 0 && target) {
    const { error: delErr } = await supabase.from('transactions').delete().eq('id', target.id)
    if (delErr) return dbFailure(delErr)
    revalidate(contractId)
    return { ok: true, error: null }
  }

  if (target) {
    // UPDATE — only touch amount (and bank_date if the caller explicitly
    // provided one). The description is intentionally PRESERVED: the row
    // was tagged with the correct marker at INSERT time, and overwriting
    // on every edit would lose context the encargada may have added and
    // re-introduce the double-suffix bug for destination cells.
    const update: Record<string, unknown> = { amount }
    if (bankDate !== null) update.bank_date = bankDate
    const { error: upErr } = await supabase.from('transactions').update(update).eq('id', target.id)
    if (upErr) return dbFailure(upErr)
  } else if (amount > 0) {
    // INSERT — fresh row, use the full description.
    const { error: insErr } = await supabase
      .from('transactions')
      .insert({
        administration_id:    administrationId,
        contract_id:          contractId,
        transaction_type_id:  typeId,
        amount,
        period,
        bank_date:            bankDate,
        description:          insertDescription,
      })
    if (insErr) return dbFailure(insErr)
  }

  revalidate(contractId)
  return { ok: true, error: null }
}

// ============================================================================
// Cycle the liquidación status: borrador → enviada → pagada → borrador.
// Wraps the existing transitionLiquidacionStatus with the next-state logic.
// ============================================================================

export async function cycleLiquidacionStatus(
  contractId: string,
  landlordId: string,
  period:     string,
  currentStatus: 'draft' | 'sent' | 'paid',
): Promise<InlineResult> {
  const nextStatus = currentStatus === 'draft' ? 'sent' : currentStatus === 'sent' ? 'paid' : 'draft'
  const { transitionLiquidacionStatus } = await import('@/lib/liquidacion/actions')
  const res = await transitionLiquidacionStatus(contractId, landlordId, period, nextStatus)
  if (!res.ok) return { ok: false, error: res.error ?? 'Error al cambiar el estado' }
  revalidate(contractId)
  return { ok: true, error: null }
}
