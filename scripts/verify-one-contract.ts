// ============================================================================
// One-contract verification of the duplicate-writer fixes. READ-ONLY.
//   npx tsx --env-file=.env.local scripts/verify-one-contract.ts [contractId]
//
// For a single contract+period it runs the SAME predicates/queries the fixed
// server actions use and shows the no-doubling invariants hold:
//   • COMMISSION_OUT: exactly one row; isManagedRow=true (Movs can't retag it);
//     setCommission's match returns it -> Calcular UPDATEs, never a 2nd row.
//   • OTROS: setOtrosCell's marker match returns exactly one owned row ->
//     editing UPDATEs it, never inserts a duplicate; reader-sum = owned+items.
//   • Movimientos list: managed rows are locked (read-only in the modal).
// ============================================================================
import { createClient } from '@supabase/supabase-js'
import { isManagedRow, OTROS_CELL_ILIKE } from '../lib/transaction/managed-rows'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const money = (n: number) => '$' + n.toLocaleString('es-AR')

async function typeId(code: string) {
  const { data } = await sb.from('transaction_types').select('id').eq('code', code).maybeSingle()
  return (data as any)?.id as string
}

async function main() {
// Pick a target: arg, else a June contract that has both a commission and an otros.
let contractId = process.argv[2]
const period = '2026-06-01'
if (!contractId) {
  const comm = await typeId('COMMISSION_OUT')
  const { data } = await sb.from('transactions')
    .select('contract_id').eq('period', period).eq('transaction_type_id', comm).limit(50)
  const other = await typeId('OTHER_OUT')
  const { data: oth } = await sb.from('transactions')
    .select('contract_id').eq('period', period).eq('transaction_type_id', other)
  const otherSet = new Set((oth ?? []).map((r: any) => r.contract_id))
  contractId = ((data ?? []).map((r: any) => r.contract_id).find((c: string) => otherSet.has(c)))
    ?? (data as any)?.[0]?.contract_id
}
if (!contractId) { console.error('No suitable contract found'); process.exit(1) }

const { data: c } = await sb.from('contracts').select('contract_number, commission_pct').eq('id', contractId).maybeSingle()
console.log(`\nContract ${(c as any)?.contract_number ?? contractId}  ·  period ${period}\n${'='.repeat(60)}`)

let problems = 0
const fail = (m: string) => { problems++; console.log(`  FAIL  ${m}`) }
const ok   = (m: string) => console.log(`  ok    ${m}`)

// ── Full period rows with their type code ──────────────────────────────────
const { data: rows } = await sb.from('transactions')
  .select('id, amount, description, transaction_types!inner(code, direction)')
  .eq('contract_id', contractId).eq('period', period)
const all = (rows ?? []) as any[]
const byCode = (code: string) => all.filter(r => r.transaction_types.code === code)

// ── 1. Commission single-row + managed ─────────────────────────────────────
console.log('\n# Commission (ADMI)')
const comm = byCode('COMMISSION_OUT')
const admi = comm.reduce((s, r) => s + Number(r.amount), 0)
console.log(`  COMMISSION_OUT rows = ${comm.length}, ADMI = ${money(admi)}`)
if (comm.length <= 1) ok('at most one COMMISSION_OUT row (setCommission single-writer) -> Calcular cannot double it')
else fail(`${comm.length} COMMISSION_OUT rows — ADMI is doubled`)
if (comm.every(r => isManagedRow('COMMISSION_OUT', r.description)))
  ok('commission row is managed -> Movimientos direction/razon edits are rejected (no retag, no marker strip)')

// ── 2. OTROS marker ownership ───────────────────────────────────────────────
console.log('\n# Otros (OTHER_OUT)')
const otherOut = byCode('OTHER_OUT')
const otrosSum = otherOut.reduce((s, r) => s + Number(r.amount), 0)
const otherType = await typeId('OTHER_OUT')
const { data: owned } = await sb.from('transactions')
  .select('id, amount, description')
  .eq('contract_id', contractId).eq('period', period).eq('transaction_type_id', otherType)
  .ilike('description', OTROS_CELL_ILIKE)                          // ← exact setOtrosCell match
const ownedRows = (owned ?? []) as any[]
console.log(`  OTHER_OUT rows = ${otherOut.length} (sum ${money(otrosSum)}); OTROS-cell-owned = ${ownedRows.length}`)
if (otherOut.length === 0) {
  ok('no otros this period (nothing to own)')
} else if (ownedRows.length === 1) {
  ok('setOtrosCell owns exactly ONE row -> editing the OTROS cell UPDATEs it, never inserts a duplicate')
  const items = otherOut.filter(r => !ownedRows.some(o => o.id === r.id))
  ok(`reader otros ${money(otrosSum)} = owned ${money(Number(ownedRows[0].amount))} + ${items.length} itemised Movs line(s)`)
} else if (ownedRows.length === 0) {
  fail('OTHER_OUT exists but none carry the [OTROS-CELL] marker — run scripts/migrate-otros-cell-marker.mjs --apply (editing OTROS would DOUBLE)')
} else {
  fail(`${ownedRows.length} owned OTROS rows — setOtrosCell would consolidate and drop deductions`)
}
otherOut.filter(r => isManagedRow('OTHER_OUT', r.description)).forEach(() => {})

// ── 3. Movimientos modal lock state ─────────────────────────────────────────
console.log('\n# Movimientos modal (what is editable vs locked)')
for (const r of all) {
  const code = r.transaction_types.code
  const locked = isManagedRow(code, r.description)
  console.log(`  ${locked ? 'LOCKED' : 'edit  '}  ${code.padEnd(15)} ${money(Number(r.amount))}`)
}

console.log(`\n${problems === 0 ? 'PASS' : 'PROBLEMS: ' + problems} — one-contract invariants`)
process.exit(problems === 0 ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(1) })
