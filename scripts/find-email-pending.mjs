// Find contracts that need an outbound email within the next 30 days.
//
// Three categories produce an "email needed" entry:
//   A. Próximo aumento ≤30d → notify TENANT + LANDLORD (new rent amount)
//   B. Vencimiento ≤30d     → ask LANDLORD (renew or rescind?)
//   C. Pago atrasado        → notify TENANT (debt notice)
//
// Run with:  node --env-file=.env.local scripts/find-email-pending.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}
const supa = createClient(url, key)

const CADENCE_MONTHS = { mensual: 1, bimestral: 2, trimestral: 3, cuatrimestral: 4, semestral: 6, anual: 12 }
function nextAdjustment(startDate, cadence, today) {
  const months = CADENCE_MONTHS[cadence]
  if (!months) return null
  const next = new Date(startDate)
  let safety = 1000
  while (next <= today && safety-- > 0) next.setMonth(next.getMonth() + months)
  return safety > 0 ? next : null
}

const today      = new Date()
const in30days   = new Date(today.getTime() + 30 * 86400000)
const CURRENT_PERIOD = '2026-06-01'   // period being audited for missing payment

console.log(`Today: ${today.toISOString().slice(0, 10)}`)
console.log(`Período auditado: ${CURRENT_PERIOD}\n`)

// ---------------------------------------------------------------------------
// Fetch active contracts with tenant + landlord email
// ---------------------------------------------------------------------------
const { data: contracts, error } = await supa
  .from('contracts')
  .select(`
    id, cadence, start_date, end_date, current_rent, payment_day, status,
    contract_tenants(is_primary, tenants(name, email)),
    contract_landlords(ownership_pct, landlords(name, email))
  `)
  .eq('status', 'active')

if (error) { console.error(error); process.exit(1) }

const { data: rentTxns } = await supa
  .from('transactions')
  .select('contract_id, transaction_types!inner(code)')
  .eq('period', CURRENT_PERIOD)
  .eq('transaction_types.code', 'RENT_IN')

const paidThisPeriod = new Set((rentTxns ?? []).map(t => t.contract_id).filter(Boolean))

// ---------------------------------------------------------------------------
// Classify each contract
// ---------------------------------------------------------------------------
const A_aviso_aumento  = []
const B_vencimiento    = []
const C_cobranza       = []

for (const c of contracts ?? []) {
  const primary  = c.contract_tenants?.find(ct => ct.is_primary) ?? c.contract_tenants?.[0]
  const tenant   = primary?.tenants
  const topOwner = (c.contract_landlords ?? [])
    .slice()
    .sort((a, b) => Number(b.ownership_pct) - Number(a.ownership_pct))[0]
  const landlord = topOwner?.landlords
  const tenantName   = tenant?.name ?? '(sin inquilino)'
  const landlordName = landlord?.name ?? '(sin propietario)'

  // A. Próximo aumento ≤30 días
  const adj = nextAdjustment(c.start_date, c.cadence, today)
  if (adj && adj >= today && adj <= in30days) {
    A_aviso_aumento.push({
      contractId:   c.id,
      tenantName, landlordName,
      tenantEmail:   tenant?.email ?? null,
      landlordEmail: landlord?.email ?? null,
      daysUntil:     Math.round((adj - today) / 86400000),
      currentRent:   Number(c.current_rent),
    })
  }

  // B. Vencimiento ≤30 días
  const end = new Date(c.end_date)
  if (end >= today && end <= in30days) {
    B_vencimiento.push({
      contractId:   c.id,
      tenantName, landlordName,
      landlordEmail: landlord?.email ?? null,
      daysUntil:     Math.round((end - today) / 86400000),
    })
  }

  // C. Cobranza vencida — payment_day passed +3 days AND no RENT_IN this period
  const dueDay = c.payment_day ?? 5
  const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay)
  const overdue = today.getTime() - dueDate.getTime()  // ms
  if (overdue >= 3 * 86400000 && !paidThisPeriod.has(c.id)) {
    C_cobranza.push({
      contractId:   c.id,
      tenantName, landlordName,
      tenantEmail:  tenant?.email ?? null,
      daysOverdue:  Math.round(overdue / 86400000),
      currentRent:  Number(c.current_rent),
    })
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const fmt = (n) => '$' + Math.round(n).toLocaleString('es-AR')

console.log(`Active contracts examined: ${contracts.length}`)
console.log(`Paid this period (${CURRENT_PERIOD}): ${paidThisPeriod.size}\n`)

console.log('═'.repeat(80))
console.log(`A. AVISO DE AUMENTO — próximo aumento ≤30 días   (${A_aviso_aumento.length} contratos)`)
console.log('   → email a inquilino + propietario con nuevo monto')
console.log('═'.repeat(80))
A_aviso_aumento.sort((a, b) => a.daysUntil - b.daysUntil)
for (const r of A_aviso_aumento.slice(0, 20)) {
  console.log(`   en ${String(r.daysUntil).padStart(2)} días · ${r.tenantName.padEnd(30).slice(0, 30)} · ${r.landlordName.padEnd(30).slice(0, 30)} · ${fmt(r.currentRent)}`)
  console.log(`              ${r.tenantEmail ?? '(sin email inquilino)'}   |   ${r.landlordEmail ?? '(sin email propietario)'}`)
}
if (A_aviso_aumento.length > 20) console.log(`   ... y ${A_aviso_aumento.length - 20} más`)

console.log('\n' + '═'.repeat(80))
console.log(`B. RENOVACIÓN — vencimiento ≤30 días               (${B_vencimiento.length} contratos)`)
console.log('   → email a propietario: renovar o rescindir?')
console.log('═'.repeat(80))
B_vencimiento.sort((a, b) => a.daysUntil - b.daysUntil)
for (const r of B_vencimiento) {
  console.log(`   en ${String(r.daysUntil).padStart(2)} días · ${r.tenantName.padEnd(30).slice(0, 30)} · ${r.landlordName.padEnd(30).slice(0, 30)}`)
  console.log(`              propietario: ${r.landlordEmail ?? '(sin email)'}`)
}

console.log('\n' + '═'.repeat(80))
console.log(`C. COBRANZA VENCIDA — pago atrasado este período   (${C_cobranza.length} contratos)`)
console.log('   → email a inquilino con aviso de mora')
console.log('═'.repeat(80))
C_cobranza.sort((a, b) => b.daysOverdue - a.daysOverdue)
for (const r of C_cobranza.slice(0, 20)) {
  console.log(`   ${String(r.daysOverdue).padStart(2)} días atrasado · ${r.tenantName.padEnd(30).slice(0, 30)} · ${r.landlordName.padEnd(30).slice(0, 30)} · ${fmt(r.currentRent)}`)
  console.log(`                       inquilino: ${r.tenantEmail ?? '(sin email)'}`)
}
if (C_cobranza.length > 20) console.log(`   ... y ${C_cobranza.length - 20} más`)

console.log('\n' + '═'.repeat(80))
console.log(`TOTAL EMAILS NEEDED: ${A_aviso_aumento.length + B_vencimiento.length + C_cobranza.length}`)
console.log('═'.repeat(80))
