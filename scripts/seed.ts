/**
 * Seed script — populates Supabase with realistic Argentine rental administration data.
 * Run: npm run seed
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { createClient } from '@supabase/supabase-js'
import { addMonths, subMonths, addDays, format } from 'date-fns'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const TENANT_SURNAMES = [
  'Pérez','García','Rodríguez','Fernández','López','Martínez','Sánchez','González','Romero','Díaz',
  'Ruiz','Hernández','Jiménez','Moreno','Álvarez','Torres','Domínguez','Vázquez','Ramos','Gil',
  'Castro','Ortiz','Núñez','Iglesias','Medina','Cortez','Garrido','Castillo','Ortega','Delgado',
  'Cabrera','Méndez','Vega','Soto','Reyes','Aguirre','Molina','Silva','Acosta','Pereira',
]

const OWNER_SURNAMES = [
  'Bianchi','Esposito','Romano','Russo','Colombo','Conti','Ferrari','Greco','Marino','Costa',
  'Bruno','Gallo','Riva','Mancini','Vitale',
]

const FIRST_NAMES = [
  'Juan','Carlos','Diego','Sebastián','Federico','Martín','Pablo','Luis','Hernán','Marcelo',
  'María','Laura','Sofía','Daniela','Valeria','Patricia','Mónica','Carolina','Florencia','Cecilia',
]

const NEIGHBORHOODS = [
  'Palermo','Belgrano','Recoleta','Villa Crespo','Caballito','Almagro','San Telmo','Boedo',
  'Núñez','Saavedra','Devoto','Colegiales','Chacarita','Floresta','Villa Urquiza','Barracas',
]

const STREETS = [
  'Av. Santa Fe','Av. Corrientes','Av. Cabildo','Av. Rivadavia','Av. Las Heras','Av. Pueyrredón',
  'Av. Córdoba','Av. Scalabrini Ortiz','Av. Juan B. Justo','Honduras','Soler','Charcas','Arenales',
  'Aráoz','Gorriti','Thames','Malabia','Salguero','Bulnes',
]

const CADENCES = [
  { name: 'trimestral', months: 3, weight: 70 },
  { name: 'semestral', months: 6, weight: 20 },
  { name: 'anual',     months: 12, weight: 10 },
]

// Argentine INDEC monthly variation %, closing at M-2 from 2026-06-06.
const IPC = [
  { month: '2024-12-01', pct: 2.7 },
  { month: '2025-01-01', pct: 2.2 },
  { month: '2025-02-01', pct: 2.4 },
  { month: '2025-03-01', pct: 3.7 },
  { month: '2025-04-01', pct: 2.8 },
  { month: '2025-05-01', pct: 1.5 },
  { month: '2025-06-01', pct: 1.6 },
  { month: '2025-07-01', pct: 1.9 },
  { month: '2025-08-01', pct: 1.9 },
  { month: '2025-09-01', pct: 2.1 },
  { month: '2025-10-01', pct: 2.3 },
  { month: '2025-11-01', pct: 2.4 },
  { month: '2025-12-01', pct: 2.7 },
  { month: '2026-01-01', pct: 2.5 },
  { month: '2026-02-01', pct: 2.6 },
  { month: '2026-03-01', pct: 2.8 },
  { month: '2026-04-01', pct: 2.4 },
]

const today = new Date('2026-06-06')

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const between = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a
const pickWeighted = <T extends { name: string; weight: number }>(arr: T[]): T => {
  const total = arr.reduce((s, a) => s + a.weight, 0)
  let r = Math.random() * total
  for (const it of arr) { if (r < it.weight) return it; r -= it.weight }
  return arr[0]
}

async function clearAll() {
  const tables = [
    'adjustments','payments','contracts','tenants','owners','bank_accounts','cpi_values','administrations',
  ]
  for (const t of tables) {
    const dateCol = t === 'cpi_values' ? 'fetched_at' : 'created_at'
    await supabase.from(t).delete().gte(dateCol, '1900-01-01')
  }
}

async function seed() {
  console.log('Clearing existing data...')
  await clearAll()

  console.log('Inserting INDEC IPC values...')
  await supabase.from('cpi_values').insert(IPC.map(c => ({ month: c.month, variation_pct: c.pct })))

  console.log('Creating administration...')
  const { data: adminRow } = await supabase.from('administrations')
    .insert({ name: 'Administración Alejandro' })
    .select().single()
  const admin_id = adminRow!.id

  console.log('Creating bank accounts...')
  const { data: banks } = await supabase.from('bank_accounts').insert([
    { administration_id: admin_id, bank_name: 'Banco Galicia',   account_alias: 'CC Galicia Principal', account_number: '0070-0123-45-678901' },
    { administration_id: admin_id, bank_name: 'Banco Santander', account_alias: 'CC Santander',         account_number: '0072-0234-56-789012' },
    { administration_id: admin_id, bank_name: 'Banco Macro',     account_alias: 'CC Macro',             account_number: '0285-0345-67-890123' },
    { administration_id: admin_id, bank_name: 'Banco BBVA',      account_alias: 'CC BBVA',              account_number: '0017-0456-78-901234' },
  ]).select()

  console.log('Creating owners...')
  const { data: owners } = await supabase.from('owners').insert(
    OWNER_SURNAMES.map(s => ({
      administration_id: admin_id,
      name: `${pick(FIRST_NAMES)} ${s}`,
      email: `${s.toLowerCase()}@example.com`,
      phone: `+54 11 ${between(4000,5999)}-${between(1000,9999)}`,
      commission_pct: pick([8, 8, 8, 10, 10, 7, 9]),
    })),
  ).select()

  console.log('Creating tenants...')
  const { data: tenants } = await supabase.from('tenants').insert(
    TENANT_SURNAMES.map((s, i) => ({
      administration_id: admin_id,
      name: `${pick(FIRST_NAMES)} ${s}`,
      email: `${s.toLowerCase()}${i}@example.com`,
      phone: `+54 11 ${between(4000,5999)}-${between(1000,9999)}`,
    })),
  ).select()

  console.log('Creating contracts...')
  const contractsToInsert = tenants!.map((t, i) => {
    const cad = pickWeighted(CADENCES)
    let nextAdj: Date
    if (i < 5)       nextAdj = addDays(today, between(1, 7))
    else if (i < 15) nextAdj = addDays(today, between(8, 30))
    else             nextAdj = addDays(today, between(31, 180))

    const startDate = subMonths(today, between(6, 36))
    const endDate = addMonths(startDate, 36)

    return {
      administration_id: admin_id,
      owner_id: owners![i % owners!.length].id,
      tenant_id: t.id,
      bank_account_id: banks![i % banks!.length].id,
      address: `${pick(STREETS)} ${between(100, 5000)}, ${pick(NEIGHBORHOODS)}, CABA`,
      property_type: Math.random() < 0.85 ? 'vivienda' : 'comercial',
      current_rent: Math.round(between(180, 500)) * 1000,
      expensas: Math.round(between(15, 45)) * 1000,
      indexer: pickWeighted([
        { name: 'IPC_GENERAL', weight: 65 },
        { name: 'ICL',         weight: 25 },
        { name: 'CASA_PROPIA', weight: 10 },
      ]).name,
      cadence: cad.name,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      next_adjustment_date: format(nextAdj, 'yyyy-MM-dd'),
      payment_day: pick([1, 5, 10]),
      late_interest_enabled: Math.random() < 0.6,
      late_interest_rate: pick([5.0, 5.0, 7.5, 10.0]),
    }
  })
  const { data: contracts } = await supabase.from('contracts').insert(contractsToInsert).select()

  console.log('Creating payments...')
  const payments: any[] = []
  contracts!.forEach((c, idx) => {
    for (let m = 6; m >= 1; m--) {
      const period = subMonths(today, m)
      const exp = new Date(period.getFullYear(), period.getMonth(), c.payment_day)
      const bank = addDays(exp, between(-1, 3))
      payments.push({
        contract_id: c.id,
        bank_account_id: c.bank_account_id,
        direction: 'IN',
        amount: c.current_rent,
        period: format(period, 'yyyy-MM-01'),
        expected_date: format(exp, 'yyyy-MM-dd'),
        bank_date: format(bank, 'yyyy-MM-dd'),
        status: 'paid',
      })
    }
    // Current month: first 7 contracts late, rest paid or pending.
    const isLate = idx < 7
    const currExp = new Date(today.getFullYear(), today.getMonth(), c.payment_day)
    payments.push({
      contract_id: c.id,
      bank_account_id: c.bank_account_id,
      direction: 'IN',
      amount: c.current_rent,
      period: format(today, 'yyyy-MM-01'),
      expected_date: format(currExp, 'yyyy-MM-dd'),
      bank_date: isLate ? null : (currExp <= today ? format(addDays(currExp, between(0, 2)), 'yyyy-MM-dd') : null),
      status: isLate ? 'late' : (currExp <= today ? 'paid' : 'pending'),
    })
  })
  for (let i = 0; i < payments.length; i += 500) {
    await supabase.from('payments').insert(payments.slice(i, i + 500))
  }

  console.log('Creating adjustment history...')
  const adjustments: any[] = []
  for (const c of contracts!) {
    const cad = CADENCES.find(x => x.name === c.cadence)!
    for (let j = 1; j <= 2; j++) {
      const monthsAgo = j * cad.months
      if (monthsAgo > 18) continue
      const applied = subMonths(today, monthsAgo)
      const windowEnd = subMonths(applied, 2)
      const windowStart = subMonths(windowEnd, cad.months - 1)
      const used = IPC.filter(v => {
        const d = new Date(v.month)
        return d >= windowStart && d <= windowEnd
      })
      if (used.length === 0) continue
      const factor = used.reduce((a, v) => a * (1 + v.pct / 100), 1)
      const oldRent = Math.round(c.current_rent / factor / 100) * 100
      adjustments.push({
        contract_id: c.id,
        applied_at: format(applied, 'yyyy-MM-dd'),
        old_rent: oldRent,
        new_rent: Math.round(oldRent * factor / 100) * 100,
        factor: +factor.toFixed(6),
        cpi_values: used,
        formula: 'compound',
        cadence_used: c.cadence,
      })
    }
  }
  await supabase.from('adjustments').insert(adjustments)

  console.log('Creating recibos...')
  const recibos: any[] = []
  let reciboCounter = 2800
  for (const c of contracts!) {
    // 3 receipts per contract (last 3 paid months)
    for (let m = 3; m >= 1; m--) {
      const fecha = subMonths(today, m)
      reciboCounter++
      recibos.push({
        contract_id: c.id,
        numero: `0001-${String(reciboCounter).padStart(8, '0')}`,
        serie: 'A',
        fecha: format(fecha, 'yyyy-MM-dd'),
        monto: c.current_rent + (c.expensas ?? 0),
        concepto: `Alquiler ${format(fecha, 'MMMM yyyy')}`,
        estado: 'emitido',
      })
    }
  }
  for (let i = 0; i < recibos.length; i += 500) {
    await supabase.from('recibos').insert(recibos.slice(i, i + 500))
  }

  console.log('\n✓ Seed complete:')
  console.log(`  1 administration · 4 banks · ${owners!.length} owners · ${tenants!.length} tenants`)
  console.log(`  ${contracts!.length} contracts · ${payments.length} payments · ${adjustments.length} adjustments · ${recibos.length} recibos · ${IPC.length} IPC values`)
}

seed().catch(e => { console.error('Seed failed:', e); process.exit(1) })
