// ============================================================================
// Logic tests for the canonical liquidacion funnel. No DB — pure functions only.
//   npx tsx scripts/test-funnel.ts
//
// Locks the rule that every settlement surface must agree on:
//     transferencia = ingresos - admi - otros + ajustes
//
// These assertions exist because the formula was previously restated in four
// places and two of them dropped the ajustes term, which is how the Resumen
// tab came to disagree with the Grilla footer on the same page and how
// liquidaciones.net_to_landlord came to differ from the amount emailed.
// ============================================================================
import {
  accumulateFunnel,
  funnelDeductions,
  funnelTransferencia,
  ADMI_TYPE_CODE,
  type FunnelTxnRow,
} from '../lib/liquidacion/funnel'

let pass = 0, fail = 0
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ok   ${name}`) }
  else      { fail++; console.log(`  FAIL ${name}`) }
}
function eq(name: string, got: unknown, want: unknown) {
  check(`${name}  (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))
}

const txn = (
  amount: unknown,
  code: string,
  direction: string,
  affects_liquidacion = true,
): FunnelTxnRow => ({ amount, transaction_types: { code, direction, affects_liquidacion } })

console.log('\n# accumulateFunnel — classification into the three buckets')
eq('empty input',        accumulateFunnel([]),        { ingresos: 0, admi: 0, otros: 0 })
eq('null input',         accumulateFunnel(null),      { ingresos: 0, admi: 0, otros: 0 })
eq('undefined input',    accumulateFunnel(undefined), { ingresos: 0, admi: 0, otros: 0 })

eq('rent lands in ingresos',
   accumulateFunnel([txn(1000, 'RENT_IN', 'IN')]),
   { ingresos: 1000, admi: 0, otros: 0 })
eq('N/F rent is also ingresos',
   accumulateFunnel([txn(400, 'RENT_NF_IN', 'IN')]),
   { ingresos: 400, admi: 0, otros: 0 })
eq('commission lands in admi, not otros',
   accumulateFunnel([txn(80, ADMI_TYPE_CODE, 'OUT')]),
   { ingresos: 0, admi: 80, otros: 0 })
eq('every other OUT lands in otros',
   accumulateFunnel([txn(50, 'EXPENSAS_OUT', 'OUT'), txn(25, 'ABL_OUT', 'OUT')]),
   { ingresos: 0, admi: 0, otros: 75 })

// affects_liquidacion=false must be skipped entirely. Deposits and internal
// transfers are real money movements that are NOT part of the settlement.
eq('deposit (affects_liquidacion=false) is skipped',
   accumulateFunnel([txn(9999, 'DEPOSIT_IN', 'IN', false)]),
   { ingresos: 0, admi: 0, otros: 0 })
eq('LANDLORD_PAYOUT (affects_liquidacion=false) is skipped',
   accumulateFunnel([txn(870, 'LANDLORD_PAYOUT', 'OUT', false)]),
   { ingresos: 0, admi: 0, otros: 0 })

// PostgREST returns numerics as strings; a missing embed must not throw.
eq('string amounts are coerced',
   accumulateFunnel([txn('1000.50', 'RENT_IN', 'IN')]),
   { ingresos: 1000.5, admi: 0, otros: 0 })
eq('null amount counts as 0',
   accumulateFunnel([txn(null, 'RENT_IN', 'IN')]),
   { ingresos: 0, admi: 0, otros: 0 })
eq('missing transaction_types embed is skipped',
   accumulateFunnel([{ amount: 500, transaction_types: null }]),
   { ingresos: 0, admi: 0, otros: 0 })

const realistic = accumulateFunnel([
  txn(1000, 'RENT_IN', 'IN'),
  txn(200,  'RECUPERO_ABL_IN', 'IN'),
  txn(96,   ADMI_TYPE_CODE, 'OUT'),
  txn(50,   'EXPENSAS_OUT', 'OUT'),
  txn(30,   'ABL_OUT', 'OUT'),
  txn(500,  'DEPOSIT_IN', 'IN', false),
])
eq('realistic month', realistic, { ingresos: 1200, admi: 96, otros: 80 })

console.log('\n# funnelDeductions — admi + otros')
eq('deductions', funnelDeductions(realistic), 176)
eq('zero buckets', funnelDeductions({ ingresos: 0, admi: 0, otros: 0 }), 0)

console.log('\n# funnelTransferencia — THE formula (must include ajustes)')
eq('no adjustment',      funnelTransferencia(realistic),      1024)
eq('default arg == 0',   funnelTransferencia(realistic, 0),   1024)
eq('positive adjustment adds',  funnelTransferencia(realistic, 100),  1124)
eq('negative adjustment subtracts', funnelTransferencia(realistic, -100), 924)

// The regression this whole module exists to prevent: dropping the term.
check('adjustment is NOT ignored',
      funnelTransferencia(realistic, 250) !== funnelTransferencia(realistic, 0))
eq('adjustment moves the result 1:1',
   funnelTransferencia(realistic, 250) - funnelTransferencia(realistic, 0), 250)

// The other half of the old ResumenView bug: it clamped at zero, hiding a real
// negative settlement that the Grilla footer showed correctly.
const underwater = { ingresos: 100, admi: 20, otros: 200 }
eq('negative transferencia is preserved, not clamped',
   funnelTransferencia(underwater), -120)
check('negative result is really negative', funnelTransferencia(underwater) < 0)

console.log('\n# identity: deductions and transferencia stay consistent')
eq('ingresos - deductions + adj == transferencia',
   funnelTransferencia(realistic, 42),
   realistic.ingresos - funnelDeductions(realistic) + 42)

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
