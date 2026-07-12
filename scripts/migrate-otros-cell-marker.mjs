// ============================================================================
// One-time migration: tag the planilla OTROS cell's own OTHER_OUT rows with the
// reserved [OTROS-CELL] marker so setOtrosCell owns them by a machine token
// instead of a user-typable description prefix.
//
// Marks OTHER_OUT rows whose description starts 'Otros descuentos' (cell/import)
// or 'Otros deducciones' (June import) and are not already marked. Leaves
// itemised Movimientos salidas ('Otros — …', free text) untouched.
//
// Safety: aborts if any (contract_id, period) would end up with more than one
// marked row (that would make setOtrosCell consolidate and drop a deduction).
// Idempotent: re-running skips already-marked rows.
//
//   node --env-file=.env.local scripts/migrate-otros-cell-marker.mjs        (dry run)
//   node --env-file=.env.local scripts/migrate-otros-cell-marker.mjs --apply (write)
// ============================================================================
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const MARKER = '[OTROS-CELL]'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const { data: tt } = await sb.from('transaction_types').select('id').eq('code', 'OTHER_OUT').maybeSingle()
if (!tt) { console.error('OTHER_OUT type not found'); process.exit(1) }

const { data: rows, error } = await sb
  .from('transactions')
  .select('id, description, contract_id, period')
  .eq('transaction_type_id', tt.id)
if (error) { console.error(error.message); process.exit(1) }

const shouldMark = (d) =>
  d && !d.includes(MARKER) && (/^otros descuentos/i.test(d) || /^otros deducciones/i.test(d))

const toMark = rows.filter(r => shouldMark(r.description))

// Safety: no (contract, period) may hold >1 row that ends up marked (including
// rows already marked from a prior run).
const alreadyMarked = rows.filter(r => (r.description ?? '').includes(MARKER))
const ownedByKey = new Map()
for (const r of [...toMark, ...alreadyMarked]) {
  const k = `${r.contract_id}|${r.period}`
  ownedByKey.set(k, (ownedByKey.get(k) ?? 0) + 1)
}
const collisions = [...ownedByKey.entries()].filter(([, n]) => n > 1)
if (collisions.length) {
  console.error(`ABORT: ${collisions.length} (contract,period) would have >1 owned OTROS row:`)
  for (const [k, n] of collisions) console.error(`  ${k}: ${n}`)
  process.exit(2)
}

console.log(`${rows.length} OTHER_OUT rows · ${toMark.length} to mark · ${alreadyMarked.length} already marked · ${rows.length - toMark.length - alreadyMarked.length} left as-is`)

if (!APPLY) {
  console.log('\nDRY RUN — re-run with --apply to write. Rows that would be marked:')
  for (const r of toMark) console.log(`  ${r.contract_id} ${r.period}  ${JSON.stringify(r.description)}`)
  process.exit(0)
}

let done = 0
for (const r of toMark) {
  const { error: uErr } = await sb
    .from('transactions')
    .update({ description: `${r.description} ${MARKER}` })
    .eq('id', r.id)
  if (uErr) { console.error(`FAILED ${r.id}: ${uErr.message}`); process.exit(3) }
  done++
}
console.log(`APPLIED: marked ${done} rows.`)
