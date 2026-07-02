'use server'

// ============================================================================
// "Liquidar y enviar mail" — split into two server actions.
//
//   prepareEmailDraft(...)        — PURE READ. Computes the period summary +
//                                   drafts subject/body. NO state change.
//                                   Called when the modal opens so the
//                                   encargada sees the preview.
//
//   markLiquidacionAsSent(...)    — Transitions the liquidación row to
//                                   'sent' and bumps the contract's
//                                   updated_at. Called ONLY when she
//                                   actually clicks one of the Send
//                                   buttons in the modal. Splitting these
//                                   prevents the bug where "Cancelar"
//                                   left the row marked as sent.
//
// Respects the saved communication-model rule: drafting and recipient
// recommendation are automated; the decision to send stays with the
// encargada. The server never actually dispatches an email; the UI
// hands off to Gmail compose / mailto: in her own browser.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure } from '@/lib/db-errors'
import { transitionLiquidacionStatus } from './actions'
import { buildReceiptAjustes, type AjusteLine } from '@/lib/contract/events-bulk'
import { fmtMoney } from '@/lib/format'
import { periodLabel } from '@/lib/period'

export interface PrepareEmailResult {
  ok:    boolean
  error: string | null
  recipient?:  string | null
  subject?:    string
  body?:       string
  summary?:    {
    landlordName:  string
    period:        string
    gross:         number
    commission:    number
    otros:         number
    ajusteLines:   AjusteLine[]
    ajustes:       number
    netToLandlord: number
  }
}

export async function prepareEmailDraft(
  contractId: string,
  landlordId: string,
  period:     string,
  /** Optional sender — included in the body signature so the propietario
   *  knows who's writing. Pure presentational; doesn't affect server state. */
  senderEmail: string | null = null,
): Promise<PrepareEmailResult> {
  const supabase = await createSupabaseServer()

  // Aggregate period transactions to compute the summary.
  const { data: txns, error: txnsErr } = await supabase
    .from('transactions')
    .select('amount, transaction_types!inner(direction, affects_liquidacion, code)')
    .eq('contract_id', contractId)
    .eq('period', period)
  if (txnsErr) return dbFailure(txnsErr)

  let gross = 0, commission = 0, otros = 0
  for (const t of (txns ?? []) as any[]) {
    const typ = t.transaction_types
    if (!typ.affects_liquidacion) continue
    if (typ.direction === 'IN') gross += Number(t.amount)
    else if (typ.code === 'COMMISSION_OUT') commission += Number(t.amount)
    else otros += Number(t.amount)
  }
  const netoTransacciones = gross - commission - otros

  // Ajustes (confirmed Observaciones + legacy manual adjustment) — same source
  // as the liquidación detail page, so the email and the receipt always match.
  const { data: liqRow } = await supabase
    .from('liquidaciones')
    .select('adjustment_amount')
    .eq('contract_id', contractId)
    .eq('landlord_id', landlordId)
    .eq('period', period)
    .maybeSingle()
  const { lines: ajusteLines, total: ajustes } = await buildReceiptAjustes(
    contractId, period, Number((liqRow as any)?.adjustment_amount ?? 0),
  )
  const netToLandlord = netoTransacciones + ajustes

  // Landlord (for recipient + name) + primary tenant (for body context).
  const [landlordRes, contractRes] = await Promise.all([
    supabase.from('landlords').select('name, email').eq('id', landlordId).maybeSingle(),
    supabase
      .from('contracts')
      .select('id, contract_tenants(is_primary, tenants(name))')
      .eq('id', contractId)
      .maybeSingle(),
  ])
  if (landlordRes.error) return dbFailure(landlordRes.error)
  if (!landlordRes.data) return { ok: false, error: 'Propietario no encontrado.' }

  const landlordName  = (landlordRes.data as any).name as string
  const landlordEmail = (landlordRes.data as any).email as string | null

  const tenant = (contractRes.data as any)?.contract_tenants?.find((ct: any) => ct.is_primary)
              ?? (contractRes.data as any)?.contract_tenants?.[0]
  const tenantName = tenant?.tenants?.name ?? '(sin inquilino)'

  // Build subject + body.
  const monthLabel = periodLabel(period)
  const subject = `Liquidación ${monthLabel} — ${landlordName}`

  const lines: string[] = []
  lines.push(`Estimado/a ${landlordName},`)
  lines.push('')
  lines.push(`Le adjuntamos el detalle de la liquidación correspondiente al período ${monthLabel}, contrato con ${tenantName}:`)
  lines.push('')
  lines.push(`  • Total cobrado:        ${fmtMoney(gross)}`)
  lines.push(`  • Comisión de admin.:   ${fmtMoney(commission)}`)
  if (otros > 0) lines.push(`  • Otros descuentos:     ${fmtMoney(otros)}`)
  for (const l of ajusteLines) {
    lines.push(`  • ${l.label}:  ${l.amount < 0 ? '−' : '+'}${fmtMoney(Math.abs(l.amount))}`)
  }
  lines.push(`  • Neto a transferir:    ${fmtMoney(netToLandlord)}`)
  lines.push('')
  lines.push('Realizaremos la transferencia en los próximos días hábiles. Cualquier consulta, quedamos a disposición.')
  lines.push('')
  lines.push('Saludos cordiales,')
  lines.push('Pampa Administración')
  if (senderEmail?.trim()) lines.push(senderEmail.trim())
  const body = lines.join('\n')

  return {
    ok:        true,
    error:     null,
    recipient: landlordEmail,
    subject,
    body,
    summary: {
      landlordName,
      period,
      gross,
      commission,
      otros,
      ajusteLines,
      ajustes,
      netToLandlord,
    },
  }
}

// ============================================================================
// Transition the liquidación row to 'sent'. Called only when the encargada
// actually clicks a Send button in the modal (Gmail compose or mailto).
// ============================================================================

export interface MarkSentResult {
  ok:    boolean
  error: string | null
}

export async function markLiquidacionAsSent(
  contractId: string,
  landlordId: string,
  period:     string,
): Promise<MarkSentResult> {
  const res = await transitionLiquidacionStatus(contractId, landlordId, period, 'sent')
  if (!res.ok) return { ok: false, error: res.error ?? 'Error al marcar como enviada' }
  return { ok: true, error: null }
}
