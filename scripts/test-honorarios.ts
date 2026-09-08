// ============================================================================
// Logic tests for the canonical honorarios amount. No DB — pure functions only.
//   npx tsx scripts/test-honorarios.ts
//
// Locks the direction of the IVA rule, which the codebase previously stated
// BOTH ways: the ContractEvent doc comment claimed the stored amount was gross
// and IVA had to be extracted (amount * 0.21 / 1.21), while the Observaciones
// modal collected a net figure and added 21% on top. Those differ by a factor
// of 1.21 on the same column.
//
// The modal is authoritative and settles it three times over: the section
// comment says "monto total (neto)", the input placeholder is "Monto (neto)"
// and its title is "Monto total de los honorarios (neto, sin IVA)". So
// amount_tenant is NET and IVA is ADDED.
// ============================================================================
import { honorarioGross } from '../lib/contract/events-types'
import { COMMISSION_IVA_RATE } from '../lib/liquidacion/thresholds'

let pass = 0, fail = 0
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ok   ${name}`) }
  else      { fail++; console.log(`  FAIL ${name}`) }
}
function eq(name: string, got: unknown, want: unknown) {
  check(`${name}  (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))
}

console.log('\n# honorarioGross — IVA is ADDED to a net amount, never extracted')
eq('sin IVA passes through',        honorarioGross(100000, false), 100000)
eq('con IVA adds 21%',              honorarioGross(100000, true),  121000)
eq('zero stays zero (sin IVA)',     honorarioGross(0, false), 0)
eq('zero stays zero (con IVA)',     honorarioGross(0, true),  0)

// The regression this exists to prevent: applying the commission convention
// (gross stored, tax extracted) to a column that stores net.
const WRONG_EXTRACTED = 100000 - (100000 * 0.21 / 1.21)   // ~82644.6 — the old doc's formula
check('does NOT extract IVA out of the amount',
      Math.abs(honorarioGross(100000, true) - WRONG_EXTRACTED) > 1)
check('con IVA is GREATER than the stored net',
      honorarioGross(100000, true) > 100000)

console.log('\n# rate comes from the shared constant, not a literal')
eq('rate is 0.21', COMMISSION_IVA_RATE, 0.21)
eq('gross == net * (1 + rate)',
   honorarioGross(250000, true), 250000 * (1 + COMMISSION_IVA_RATE))
check('matches the modal preview formula net * 1.21',
      honorarioGross(250000, true) === 250000 * 1.21)

console.log('\n# coercion — PostgREST returns numerics as strings')
eq('string amount, con IVA',  honorarioGross('100000' as unknown as number, true),  121000)
eq('string amount, sin IVA',  honorarioGross('100000' as unknown as number, false), 100000)
eq('null amount is 0',        honorarioGross(null as unknown as number, true), 0)
eq('undefined amount is 0',   honorarioGross(undefined as unknown as number, true), 0)
eq('NaN amount is 0',         honorarioGross(NaN, true), 0)

console.log('\n# realistic cuotas plan — 3 cuotas of a 300.000 neto total')
const cuotas = [100000, 100000, 100000]
eq('sin IVA total', cuotas.reduce((s, c) => s + honorarioGross(c, false), 0), 300000)
eq('con IVA total', cuotas.reduce((s, c) => s + honorarioGross(c, true),  0), 363000)

// A period mixes both kinds — this is what the three consumers must produce.
const period = [
  { amount: 100000, iva: true  },
  { amount:  50000, iva: false },
  { amount:  80000, iva: true  },
]
eq('mixed period total',
   period.reduce((s, e) => s + honorarioGross(e.amount, e.iva), 0),
   121000 + 50000 + 96800)
check('mixed period beats the raw net sum',
      period.reduce((s, e) => s + honorarioGross(e.amount, e.iva), 0) >
      period.reduce((s, e) => s + e.amount, 0))

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
