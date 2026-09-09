// ============================================================================
// Logic tests for the canonical commission formula. No DB — pure functions only.
//   npx tsx scripts/test-commission.ts
//
// Locks:  comision = ingresos x pct% x (1.21 when the invoicer is RI)
//
// and, just as importantly, locks the CALLER contract: the percentage passed in
// must be the CONFIGURED rate (contracts.commission_pct), never the effective
// rate the grid displays (admi / ingresos * 100). Feeding it the effective rate
// makes the result collapse back to `admi` itself — which is exactly how the
// planilla's "monto implausible" ceiling became a guard that can never fire.
// ============================================================================
import {
  expectedCommission,
  commissionIvaFactor,
  COMMISSION_IVA_RATE,
} from '../lib/liquidacion/thresholds'

let pass = 0, fail = 0
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ok   ${name}`) }
  else      { fail++; console.log(`  FAIL ${name}`) }
}
function eq(name: string, got: unknown, want: unknown) {
  check(`${name}  (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))
}
const near = (name: string, got: number, want: number, tol = 0.005) =>
  check(`${name}  (got ${got})`, Math.abs(got - want) <= tol)

console.log('\n# commissionIvaFactor')
eq('monotributo -> 1',  commissionIvaFactor(false), 1)
eq('RI -> 1.21',        commissionIvaFactor(true),  1.21)
eq('rate constant',     COMMISSION_IVA_RATE, 0.21)

console.log('\n# expectedCommission — the forward formula')
near('1.000.000 @ 9% sin IVA',  expectedCommission(1000000, 9, false),  90000)
near('1.000.000 @ 9% con IVA',  expectedCommission(1000000, 9, true),   108900)
// Real figure documented in lib/liquidacion/queries.ts (~963): the receipts
// show "ADM 9% + IVA = $100.188", i.e. 920.000 x 9% = 82.800, x 1.21 = 100.188.
near('receipt case: ADM 9% + IVA = 100.188', expectedCommission(920000, 9, true), 100188)
near('...and its net half is 82.800',        expectedCommission(920000, 9, false), 82800)
near('8% sin IVA',              expectedCommission(500000, 8, false),   40000)
near('10% comercial con IVA',   expectedCommission(1900000, 10, true),  229900)

console.log('\n# degenerate inputs never throw or produce NaN')
eq('zero ingresos',    expectedCommission(0, 9, true), 0)
eq('zero pct',         expectedCommission(1000000, 0, true), 0)
eq('null ingresos',    expectedCommission(null as unknown as number, 9, true), 0)
eq('null pct',         expectedCommission(1000000, null as unknown as number, true), 0)
eq('NaN ingresos',     expectedCommission(NaN, 9, false), 0)
eq('string ingresos',  expectedCommission('1000000' as unknown as number, 9, false), 90000)

console.log('\n# IVA is ADDED on top, not extracted')
check('con IVA > sin IVA', expectedCommission(1000000, 9, true) > expectedCommission(1000000, 9, false))
near('the difference IS the IVA',
     expectedCommission(1000000, 9, true) - expectedCommission(1000000, 9, false),
     90000 * COMMISSION_IVA_RATE)

console.log('\n# THE TRAP — effective pct collapses back to the recorded amount')
// The grid derives `pct` as admi/ingresos*100. Feeding that back in returns
// `admi`, so a ceiling built from it equals the value it is meant to bound.
const ingresos = 1000000
const admi     = 90000
const effectivePct = (admi / ingresos) * 100        // = 9, derived from admi
near('effective pct round-trips to admi',
     expectedCommission(ingresos, effectivePct, false), admi)
check('=> such a ceiling can never be exceeded',
      expectedCommission(ingresos, effectivePct, false) === admi)
// With the CONFIGURED pct the ceiling is independent of what was recorded, so
// an under-recorded commission is correctly flagged as below expectation.
const configuredPct = 9
const underRecorded = 50000
check('configured pct gives a ceiling independent of admi',
      expectedCommission(ingresos, configuredPct, false) !== underRecorded)

console.log('\n# writer parity — 2-decimal rounding done by the caller')
const raw = expectedCommission(1113200, 9, true)   // 100.188 x 1.21 = 121.227,48
eq('caller rounds to 2 decimals', Math.round(raw * 100) / 100, 121227.48)

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
