// ============================================================================
// check-proyecciones — cuantos contratos activos tienen HOY un aumento
// proyectado sin confirmar, o sea cuantos van a ver el aviso nuevo del panel
// de Deuda.
//
//   npx tsx scripts/check-proyecciones.ts [YYYY-MM-01]
//
// Corre la MISMA funcion que usa la planilla (expectedRentForPeriod, en
// lib/contract/aumento.ts) sobre los datos reales, en vez de estimar con SQL.
// Asi el numero que sale es el que el usuario va a ver, no una aproximacion.
//
// Solo lectura: usa la conexion claude_ro, que no puede escribir.
// ============================================================================

import { Client, types } from 'pg'
import { config } from 'dotenv'
import { expectedRentForPeriod } from '../lib/contract/aumento'

config({ path: '.env.local' })
types.setTypeParser(1082, v => v)   // date -> texto, sin corrimiento de zona
types.setTypeParser(1700, v => v)   // numeric -> texto, sin perder centavos

const period = process.argv[2] ?? '2026-09-01'

async function main() {
  const CONN = process.env.DATABASE_URL_RO
  if (!CONN) { console.error('Falta DATABASE_URL_RO en .env.local'); process.exit(1) }

  const c = new Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } })
  await c.connect()

  const cpi = await c.query('select month, index_value from cpi_values')
  const indexByMonth: Record<string, number> = {}
  for (const r of cpi.rows as any[]) {
    const m = String(r.month).slice(0, 7)
    if (r.index_value != null) indexByMonth[m] = Number(r.index_value)
  }

  const res = await c.query(`
    select contract_number, current_rent, cadence, start_date,
           last_adjustment_date, created_at::date as created
    from contracts where status = 'active'
    order by contract_number
  `)
  await c.end()

  const conAumento: { n: string; cargado: number; proyectado: number }[] = []
  let sinIndice = 0

  for (const r of res.rows as any[]) {
    if (!r.cadence || !r.start_date) continue
    const cargado = Number(r.current_rent) || 0
    const er = expectedRentForPeriod({
      startDate:          String(r.start_date),
      cadence:            String(r.cadence),
      currentRent:        cargado,
      lastAdjustmentDate: r.last_adjustment_date ? String(r.last_adjustment_date) : null,
      createdAt:          r.created ? String(r.created) : null,
      period,
      indexByMonth,
    })
    if (er.ipcMissing) sinIndice++
    if (Math.abs(er.value - cargado) > 0.005) {
      conAumento.push({ n: r.contract_number, cargado, proyectado: er.value })
    }
  }

  const f = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  console.log(`Periodo ${period} · ${res.rows.length} contratos activos`)
  console.log(`Con aumento proyectado sin confirmar: ${conAumento.length}`)
  console.log(`Con aumento previsto pero SIN indice IPC cargado: ${sinIndice}`)
  console.log('')
  for (const x of conAumento) {
    console.log(`  ${x.n}  cargado ${f(x.cargado).padStart(14)}  ->  proyectado ${f(x.proyectado).padStart(14)}`)
  }
}

main()
