// ============================================================================
// db-query — correr un SELECT contra la base y ver el resultado en consola.
//
//   npx tsx scripts/db-query.ts "select count(*) from contracts"
//   npx tsx scripts/db-query.ts -f consulta.sql
//
// POR QUE EXISTE (2026-09-17)
//
// Hasta hoy, cada dato de la base pasaba por el usuario: yo escribia una
// consulta, el la corria en Supabase y me pegaba el resultado. Funciona, pero
// una consulta mal planteada se descubre recien despues de razonar sobre el
// resultado equivocado. Paso dos veces el mismo dia: interprete pagos parciales
// donde habia un alquiler viejo, y un alquiler en dos partes donde tampoco.
//
// SOLO LECTURA, Y NO POR DISCIPLINA
//
// Se conecta con el rol claude_ro, que tiene GRANT SELECT y nada mas. Un insert
// o un update no es que "no se hagan": la base los rechaza. Ademas este script
// corta cualquier sentencia que no empiece con select o with, asi que hay dos
// cierres y el de la base es el que vale.
//
// La cadena de conexion vive en .env.local (DATABASE_URL_RO), que esta en
// .gitignore. Nunca se imprime ni se commitea.
// ============================================================================

import { readFileSync } from 'node:fs'
import { Client, types } from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })

// Las columnas `date` vuelven como Date de JS a medianoche LOCAL, asi que
// imprimirlas corre el dia: start_date 2025-12-01 se veia "2025-11-30T15:00Z"
// en una maquina en UTC+9. Un dia de corrimiento en fechas de contrato es
// exactamente el tipo de error que despues se razona como si fuera un dato.
// Devolverlas como texto crudo, tal cual estan en la base.
types.setTypeParser(1082, v => v)   // date
// Igual para numeric: sin esto los montos vuelven como string igual, pero
// dejarlo explicito documenta que NO se convierten a float (perderian centavos).
types.setTypeParser(1700, v => v)   // numeric

const args = process.argv.slice(2)
const sql = args[0] === '-f'
  ? readFileSync(args[1], 'utf8')
  : args.join(' ')

if (!sql.trim()) {
  console.error('Uso: npx tsx scripts/db-query.ts "select ..."')
  process.exit(1)
}

// Primer cierre. El de verdad lo pone el GRANT del rol; este solo evita mandar
// por accidente algo que la base va a rechazar igual.
//
// Va ANTES de mirar la configuracion a proposito: asi la guarda se puede probar
// sin credenciales, y un comando invalido se rechaza sea cual sea el entorno.
const head = sql.trim().toLowerCase().replace(/^--.*$/gm, '').trim()
if (!/^(select|with)\b/.test(head)) {
  console.error('Solo SELECT. Las migraciones las corre el usuario en Supabase.')
  process.exit(1)
}

const CONN = process.env.DATABASE_URL_RO
if (!CONN) {
  console.error('Falta DATABASE_URL_RO en .env.local')
  process.exit(1)
}

// tsx compila a CJS, que no admite await de primer nivel.
async function main() {
  const client = new Client({
    connectionString: CONN,
    ssl: { rejectUnauthorized: false },
    // Una consulta que se cuelga no deberia dejar el proceso esperando.
    statement_timeout: 30_000,
  })
  try {
    await client.connect()
    const res = await client.query(sql)
    if (res.rows.length === 0) {
      console.log('(sin filas)')
    } else {
      console.table(res.rows)
      console.log(`${res.rows.length} fila${res.rows.length === 1 ? '' : 's'}`)
    }
  } catch (err) {
    // El mensaje de Postgres alcanza; el stack no aporta nada aca.
    console.error('ERROR:', (err as Error).message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
