'use server'

// ============================================================================
// "Liquidar y enviar mail" — server action.
//
// Phase 4 of Alejandro's June-16 spec. The encargada clicks "Liquidar y
// enviar" on a row → confirmation modal opens → on Enviar the app:
//   1. Computes the period's liquidación summary (gross, comisión, otros, neto)
//   2. Builds a Spanish email body + subject from a template
//   3. Transitions the liquidación status to "sent"
//   4. Returns the prepared subject/body/recipient to the caller, which
//      opens a mailto: link so the encargada's own email client sends
//      the message
//
// IMPORTANT — respects the saved communication-model rule: drafting and
// recipient recommendation are automated; the decision to send stays
// with the encargada. The server never actually dispatches an email.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import { dbFailure } from '@/lib/db-errors'
import { transitionLiquidacionStatus } from './actions'
import { fmtMoney } from '@/lib/format'
import { periodLabel } from '@/lib/period'

export interface LiquidarAndEmailResult {
  ok:    boolean
  error: string | null
  /** Pre-filled email envelope — caller uses these to build the mailto: URL. */
  recipient?:  string | null    // landlord email, may be null if not on file
  subject?:    string
  body?:       string
  /** Useful for the UI: short summary the encargada can sanity-check. */
  summary?:    {
    landlordName:  string
    period:        string
    gross:         number
    commission:    number
    otros:         number
    netToLandlord: number
  }
}

export async function liquidarAndPrepareEmail(
  contractId: string,
  landlordId: string,
  period:     string,
): Promise<LiquidarAndEmailResult> {
  const supabase = await createSupabaseServer()

  // 1. Compute the period's aggregates from current transactions.
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
    if (typ.direction === 'IN') {
      gross += Number(t.amount)
    } else if (typ.code === 'COMMISSION_OUT') {
      commission += Number(t.amount)
    } else {
      otros += Number(t.amount)
    }
  }
  const netToLandlord = gross - commission - otros

  // 2. Fetch landlord (for the recipient email + name) and primary tenant
  //    (for context in the body).
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

  const landlordName = (landlordRes.data as any).name as string
  const landlordEmail = (landlordRes.data as any).email as string | null

  const tenant = (contractRes.data as any)?.contract_tenants?.find((ct: any) => ct.is_primary)
              ?? (contractRes.data as any)?.contract_tenants?.[0]
  const tenantName = tenant?.tenants?.name ?? '(sin inquilino)'

  // 3. Build email subject + body in Spanish, with the typical
  //    "estimado/a + summary" template the encargada would write by hand.
  const monthLabel = periodLabel(period)
  const subject = `Liquidación ${monthLabel} — ${landlordName}`

  const lines: string[] = []
  lines.push(`Estimado/a ${landlordName},`)
  lines.push('')
  lines.push(`Le adjuntamos el detalle de la liquidación correspondiente al período ${monthLabel}, contrato con ${tenantName}:`)
  lines.push('')
  lines.push(`  • Total cobrado:        ${fmtMoney(gross)}`)
  lines.push(`  • Comisión de admin.:   ${fmtMoney(commission)}`)
  if (otros > 0) {
    lines.push(`  • Otros descuentos:     ${fmtMoney(otros)}`)
  }
  lines.push(`  • Neto a transferir:    ${fmtMoney(netToLandlord)}`)
  lines.push('')
  lines.push('Realizaremos la transferencia en los próximos días hábiles. Cualquier consulta, quedamos a disposición.')
  lines.push('')
  lines.push('Saludos cordiales,')
  lines.push('Pampa Administración')

  const body = lines.join('\n')

  // 4. Transition the liquidación to "sent" — this also fires the
  //    liquidaciones→contracts trigger which bumps the parent contract's
  //    updated_at, so the row gets the recently-edited tint after sending.
  const trans = await transitionLiquidacionStatus(contractId, landlordId, period, 'sent')
  if (!trans.ok) return { ok: false, error: trans.error }

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
      netToLandlord,
    },
  }
}
