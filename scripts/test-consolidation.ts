// ============================================================================
// Logic tests for the duplicate-logic consolidations. No DB — pure functions.
//   npx tsx scripts/test-consolidation.ts
// ============================================================================
import {
  classifyDestination, deriveCommissionDest, buildCommissionMarker,
  bankShortFromDescription, COMMISSION_MARKER_RE,
} from '../lib/bancos/destination'
import { equalSplit, isPctSum100 } from '../lib/shared/percentages'
import { resolveCommissionPct, DEFAULT_COMMISSION_PCT } from '../lib/contract/create-helpers'
import { pickPrimaryLandlord } from '../lib/contract/primary'
import { hasRentForAudit, isRecentlyTouched } from '../lib/contract/urgency'

let pass = 0, fail = 0
const check = (n: string, c: boolean) => { c ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n}`)) }
const eq = (n: string, got: unknown, want: unknown) => check(`${n}  (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))

console.log('\n# bank destination — one classifier for all surfaces')
eq('galicia',   classifyDestination('Comision 8% · ADM_GALICIA'), 'ADM_GALICIA')
eq('50_9',      classifyDestination('x ADM_FRANCES_50_9'), 'ADM_FRANCES_50_9')
eq('51_6',      classifyDestination('x ADM_FRANCES_51_6'), 'ADM_FRANCES_51_6')
eq('none→OTHER', classifyDestination('Comision junio'), 'OTHER')
eq('null→OTHER', classifyDestination(null), 'OTHER')
eq('derive none→undefined', deriveCommissionDest('Comision junio'), undefined)
eq('derive galicia', deriveCommissionDest('· ADM_GALICIA'), 'ADM_GALICIA')
eq('marker format', buildCommissionMarker('ADM_GALICIA'), ' · ADM_GALICIA')
eq('short label', bankShortFromDescription('· ADM_FRANCES_50_9'), 'BBVA 50-9')
eq('short label none', bankShortFromDescription('nope'), null)
// round-trip: build a marker, classify it back
eq('round-trip', classifyDestination(`Comision${buildCommissionMarker('ADM_FRANCES_51_6')}`), 'ADM_FRANCES_51_6')
// strip regex removes the marker
eq('strip marker', `Comision 8%${buildCommissionMarker('ADM_GALICIA')}`.replace(COMMISSION_MARKER_RE, '').trim(), 'Comision 8%')

console.log('\n# equalSplit — co-ownership / co-tenancy sums to 100')
eq('n=1', equalSplit(1), [100])
eq('n=2', equalSplit(2), [50, 50])
eq('n=3', equalSplit(3), [33.34, 33.33, 33.33])
check('n=3 sums 100', isPctSum100(equalSplit(3)))
check('n=7 sums 100', isPctSum100(equalSplit(7)))
check('every n=6 row in (0,100]', equalSplit(6).every(v => v > 0 && v <= 100))

console.log('\n# resolveCommissionPct — both create paths agree')
eq('blank→default', resolveCommissionPct(''), { ok: true, value: DEFAULT_COMMISSION_PCT })
eq('null→default',  resolveCommissionPct(null), { ok: true, value: DEFAULT_COMMISSION_PCT })
eq('25→25',         resolveCommissionPct('25'), { ok: true, value: 25 })
eq('number 12.5',   resolveCommissionPct(12.5), { ok: true, value: 12.5 })
check('101 rejected', resolveCommissionPct('101').ok === false)
check('-1 rejected',  resolveCommissionPct(-1).ok === false)

console.log('\n# pickPrimaryLandlord — highest ownership, no sort-order surprises')
eq('70/30 picks 70', pickPrimaryLandlord([{ ownership_pct: 30, landlords: { name: 'A' } }, { ownership_pct: 70, landlords: { name: 'B' } }]).landlords.name, 'B')
eq('empty→undefined', pickPrimaryLandlord([]), undefined)
eq('null→undefined',  pickPrimaryLandlord(null), undefined)
eq('string pcts',     pickPrimaryLandlord([{ ownership_pct: '40' }, { ownership_pct: '60' }]).ownership_pct, '60')

console.log('\n# urgency audit inputs — list and detail share the rule')
check('rent paid > 0',        hasRentForAudit(120000))
check('no rent → false',      !hasRentForAudit(0))
const now = new Date('2026-07-12T12:00:00Z').getTime()
check('recent rent 47h',      isRecentlyTouched({ rentBankDate: '2026-07-10T14:00:00Z', now }))
check('old rent 72h → false', !isRecentlyTouched({ rentBankDate: '2026-07-09T00:00:00Z', now }))
check('recent note',          isRecentlyTouched({ noteUpdatedAt: '2026-07-11T12:00:00Z', now }))
check('nothing → false',      !isRecentlyTouched({ now }))

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
