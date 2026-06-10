// ============================================================================
// Plantilla — the monthly ledger view that mirrors Alejandro's Excel sheet.
// One row per contract per period, with the ~22 columns his team works with.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'

export interface PlantillaRow {
  contractId:        string

  // Column 1 — OBSERVACION (free notes about banking / accountant for the contract)
  observacion:       string | null

  // Column 2 — L/F/A (legacy categorisation from his sheet, not modelled in DB yet)
  lfa:               string | null

  // Column 3 — FECHA INGRESO POR BANCO
  fechaIngresoBanco: string | null

  // Column 4 — PROPIETARIOS (concatenated names of co-owners)
  propietarios:      string

  // Column 5 — EXPENSAS ("x" if contract has expensas amount, blank otherwise)
  expensas:          boolean

  // Column 6 — INQUILINOS (concatenated co-tenants + phone)
  inquilinos:        string

  // Column 7 — AUMENTOS (cadence: Trimestral / IPC / Anual / ...)
  aumentos:          string

  // Column 8 — % (commission percentage on this contract)
  commissionPct:     number

  // Column 9 — CONTRATO ("01/02/2025 - 31/01/2027")
  contrato:          string

  // Column 10 — DEUDA Y/U OBSERVACIONES (per-period notes, free text)
  deudaObs:          string | null

  // Column 11 — PERIODO ("MARZO", "ABRIL", ...)
  periodoLabel:      string

  // Column 12 — INGRESOS (RENT_IN + OTHER_IN for this period)
  ingresos:          number

  // Column 13 — TRANSFERENCIA (LANDLORD_PAYOUT for this period)
  transferencia:     number

  // Column 14 — OTROS DEDUC Y/O INGRESOS
  otrosDeduc:        number

  // Column 15 — Dia transf. (day the transfer hit)
  diaTransf:         string | null

  // Column 16 — E (unknown legacy flag; currently a blank placeholder)
  e:                 string | null

  // Column 17 — ADMI (total commission distributed across all admin accounts)
  admi:              number

  // Column 18 — ADM GALICIA
  admGalicia:        number

  // Column 19 — ADM BCO FRANCES CTA 50/9
  admFrances50_9:    number

  // Column 20 — ADM FLAVIO BCO FRANCES CTA 51/6
  admFrances51_6:    number

  // Column 21 — Mails (landlord email)
  mails:             string | null

  // Column 22 — Liiqui (✓ if landlord_payout was issued)
  liqui:             boolean
}

const MONTHS_LARGE = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  return `${MONTHS_LARGE[+m - 1]} ${y}`
}

function fmtDate(s: string): string {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function destinationBucket(description: string | null): 'galicia' | 'frances509' | 'frances516' | null {
  const s = description ?? ''
  if (s.includes('ADM_GALICIA'))       return 'galicia'
  if (s.includes('ADM_FRANCES_50_9'))  return 'frances509'
  if (s.includes('ADM_FRANCES_51_6'))  return 'frances516'
  return null
}

/**
 * Get every contract × period row for a given period.
 * Period format: YYYY-MM-DD (first-of-month, e.g. '2026-05-01').
 */
export async function listPlantillaRows(period: string): Promise<PlantillaRow[]> {
  const supabase = await createSupabaseServer()

  const [contractsRes, txnsRes, notesRes] = await Promise.all([
    supabase
      .from('contracts')
      .select(`
        id, current_rent, cadence, indexer, expensas, start_date, end_date, status, notes,
        contract_landlords(ownership_pct, landlords(name, email)),
        contract_tenants(is_primary, tenants(name, phone)),
        contract_administrators(share_pct)
      `)
      .neq('status', 'rescinded')
      .order('start_date', { ascending: false }),
    supabase
      .from('transactions')
      .select(`
        amount, description, contract_id, bank_date,
        transaction_types!inner(code, direction)
      `)
      .eq('period', period),
    supabase
      .from('contract_period_notes')
      .select('contract_id, body')
      .eq('period', period),
  ])

  // Per-contract transaction roll-up for this period
  type Bucket = {
    ingresos: number;          // RENT_IN + OTHER_IN
    transferencia: number;     // LANDLORD_PAYOUT
    otrosDeduc: number;        // OTHER_OUT
    admi: number;              // total COMMISSION_OUT
    galicia: number;
    frances509: number;
    frances516: number;
    firstInBankDate: string | null;
    firstOutBankDate: string | null;
  }
  const bucket = new Map<string, Bucket>()
  function getBucket(id: string): Bucket {
    let b = bucket.get(id)
    if (!b) {
      b = {
        ingresos: 0, transferencia: 0, otrosDeduc: 0,
        admi: 0, galicia: 0, frances509: 0, frances516: 0,
        firstInBankDate: null, firstOutBankDate: null,
      }
      bucket.set(id, b)
    }
    return b
  }

  for (const t of (txnsRes.data ?? []) as any[]) {
    if (!t.contract_id) continue
    const b = getBucket(t.contract_id)
    const code = t.transaction_types.code as string
    const amt = Number(t.amount)
    if (code === 'RENT_IN' || code === 'OTHER_IN') {
      b.ingresos += amt
      if (t.bank_date && (!b.firstInBankDate || t.bank_date < b.firstInBankDate)) b.firstInBankDate = t.bank_date
    } else if (code === 'LANDLORD_PAYOUT') {
      b.transferencia += amt
      if (t.bank_date && (!b.firstOutBankDate || t.bank_date < b.firstOutBankDate)) b.firstOutBankDate = t.bank_date
    } else if (code === 'OTHER_OUT') {
      b.otrosDeduc += amt
    } else if (code === 'COMMISSION_OUT') {
      b.admi += amt
      const dest = destinationBucket(t.description)
      if (dest === 'galicia')    b.galicia    += amt
      if (dest === 'frances509') b.frances509 += amt
      if (dest === 'frances516') b.frances516 += amt
    }
  }

  // Per-contract notes (the DEUDA Y/U OBSERVACIONES column)
  const noteByContract = new Map<string, string>()
  for (const n of (notesRes.data ?? []) as any[]) {
    if (n.body) noteByContract.set(n.contract_id, n.body)
  }

  const label = periodLabel(period)

  return (contractsRes.data ?? []).map((c: any): PlantillaRow => {
    const owners  = (c.contract_landlords ?? []).map((cl: any) => cl.landlords?.name).filter(Boolean)
    const tenants = (c.contract_tenants ?? []).map((ct: any) => {
      const name  = ct.tenants?.name ?? ''
      const phone = ct.tenants?.phone ? ` (${ct.tenants.phone})` : ''
      return name + phone
    }).filter(Boolean)

    const firstOwnerEmail = (c.contract_landlords ?? [])
      .map((cl: any) => cl.landlords?.email)
      .find((e: string | null) => !!e) ?? null

    // Sum of contract_administrators.share_pct = total commission % for the contract
    const totalSharePct = (c.contract_administrators ?? [])
      .reduce((s: number, ca: any) => s + Number(ca.share_pct ?? 0), 0)

    const b = bucket.get(c.id) ?? null

    return {
      contractId:        c.id,
      observacion:       null,
      lfa:               null,
      fechaIngresoBanco: b?.firstInBankDate ?? null,
      propietarios:      owners.join(' / '),
      expensas:          Number(c.expensas ?? 0) > 0,
      inquilinos:        tenants.join(' / '),
      aumentos:          cadenceLabel(c.cadence, c.indexer),
      commissionPct:     totalSharePct,
      contrato:          `${fmtDate(c.start_date)} - ${fmtDate(c.end_date)}`,
      deudaObs:          noteByContract.get(c.id) ?? null,
      periodoLabel:      label,
      ingresos:          b?.ingresos ?? 0,
      transferencia:     b?.transferencia ?? 0,
      otrosDeduc:        b?.otrosDeduc ?? 0,
      diaTransf:         b?.firstOutBankDate ?? null,
      e:                 null,
      admi:              b?.admi ?? 0,
      admGalicia:        b?.galicia ?? 0,
      admFrances50_9:    b?.frances509 ?? 0,
      admFrances51_6:    b?.frances516 ?? 0,
      mails:             firstOwnerEmail,
      liqui:             (b?.transferencia ?? 0) > 0,
    }
  })
}

function cadenceLabel(cadence: string, indexer: string): string {
  if (indexer && indexer.toUpperCase() === 'IPC') return 'IPC'
  if (!cadence) return ''
  return cadence[0].toUpperCase() + cadence.slice(1)
}

/**
 * Distinct periods that have any transactions — for the period selector.
 */
export async function listPlantillaPeriods(): Promise<string[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('transactions')
    .select('period')
    .not('period', 'is', null)
  const seen = new Set<string>()
  for (const r of (data ?? []) as any[]) if (r.period) seen.add(r.period)
  return [...seen].sort().reverse()
}
