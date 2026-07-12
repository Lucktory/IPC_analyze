// ============================================================================
// Logic tests for the duplicate-writer guards. No DB — pure functions only.
//   npx tsx scripts/test-managed-rows.ts
// Exercises exactly the decision logic that stops the Movimientos editor from
// retagging a commission (doubled ADMI) and the OTROS cell from adopting a
// Movs line.
// ============================================================================
import {
  isManagedRow,
  managedRowMessage,
  stripOtrosMarker,
  MANAGED_TYPE_CODES,
  OTROS_CELL_MARKER,
} from '../lib/transaction/managed-rows'
import { normalizeLfa } from '../lib/contract/lfa'

let pass = 0, fail = 0
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ok   ${name}`) }
  else      { fail++; console.log(`  FAIL ${name}`) }
}
function eq(name: string, got: unknown, want: unknown) {
  check(`${name}  (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))
}

console.log('\n# isManagedRow — the Movimientos guard predicate')
// These MUST be locked so updateMovimiento/updateTransaction reject edits.
check('COMMISSION_OUT is managed',            isManagedRow('COMMISSION_OUT', 'Comision 8% [ADM_GALICIA]'))
check('LANDLORD_PAYOUT is managed',           isManagedRow('LANDLORD_PAYOUT', null))
check('RENT_IN is managed',                   isManagedRow('RENT_IN', 'Alquiler MAYO'))
check('RENT_NF_IN is managed',                isManagedRow('RENT_NF_IN', null))
check('OTHER_OUT + marker is managed',        isManagedRow('OTHER_OUT', `Otros descuentos ${OTROS_CELL_MARKER}`))
// These MUST stay editable in the Movimientos modal.
check('plain OTHER_OUT is NOT managed',       !isManagedRow('OTHER_OUT', 'Otros — ACT DEPOSITO'))
check('OTHER_IN is NOT managed',              !isManagedRow('OTHER_IN', 'Reintegro'))
check('user "Otros descuentos" razon is NOT managed (no marker)',
                                              !isManagedRow('OTHER_OUT', 'Otros descuentos rotura vidrio'))
check('imported "Otros deducciones" pre-migration is NOT managed',
                                              !isManagedRow('OTHER_OUT', 'Otros deducciones 06/2026'))
eq('MANAGED_TYPE_CODES set', [...MANAGED_TYPE_CODES], ['COMMISSION_OUT','LANDLORD_PAYOUT','RENT_IN','RENT_NF_IN'])

console.log('\n# stripOtrosMarker — a razon can never forge the cell marker')
eq('strips a forged marker',      stripOtrosMarker(`Reparacion ${OTROS_CELL_MARKER}`), 'Reparacion')
eq('leaves clean text',           stripOtrosMarker('Reparacion plomeria'), 'Reparacion plomeria')
eq('null stays null',             stripOtrosMarker(null), null)
eq('marker-only collapses to null', stripOtrosMarker(OTROS_CELL_MARKER), null)
check('stripped text is not managed', !isManagedRow('OTHER_OUT', stripOtrosMarker(`x ${OTROS_CELL_MARKER}`)))

console.log('\n# managedRowMessage — points to the owning cell')
check('commission message mentions ADMI', /ADMI/.test(managedRowMessage('COMMISSION_OUT')))
check('rent message mentions Alquiler',    /Alquiler/.test(managedRowMessage('RENT_IN')))

console.log('\n# normalizeLfa — one rule for every writer')
eq('lowercase a -> A',   normalizeLfa('a'),  { ok: true, value: 'A' })
eq('  fl  -> FL',        normalizeLfa('  fl  '), { ok: true, value: 'FL' })
eq('empty -> null',      normalizeLfa(''),   { ok: true, value: null })
eq('null -> null',       normalizeLfa(null), { ok: true, value: null })
check('out-of-set x rejected', normalizeLfa('x').ok === false)

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
