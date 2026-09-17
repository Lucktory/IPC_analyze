// ============================================================================
// Deuda breakdown — per-contract debt computation with carryover + intereses.
//
// Surfaces both per-row on the planilla (via the inline cell + popover) and
// as an embedded section on /contratos/[id], so the data shape and the
// presentational component (DeudaBreakdownPanel) live globally.
//
// Per Alejandro 2026-06-18: he wants the Deuda cell to expand into a sub-
// solapa showing what makes up the debt — this period's unpaid rent +
// arrastrado + (optional) intereses por mora.
//
// Assumptions (explicit so future-me can revisit):
//   • Carryover scans the last 12 prior periods (CARRYOVER_PERIODS), bounded
//     three ways: DEUDA_EPOCH (nothing before it is derived as debt), the
//     contract's start_date, and its own first recorded month (anything
//     earlier predates the import).
//   • Debt from BEFORE the epoch is not inferred from absence — it is loaded
//     by hand into the `deuda_anterior` table, one row per contract+month.
//     Those months were never fully worked in the system, so a missing rent
//     row there means "nobody loaded it", not "nobody paid".
//   • Historical rent comes from the `adjustments` table: a past month is
//     valued at the rent in force THEN, not at today's. (Until 2026-09-10 this
//     used current_rent for every prior period, which over-stated the debt of
//     any contract that had since had an increase.)
//   • Intereses = totalDebt × rate% × daysOverdue. DIARIO y simple, no
//     compuesto. Mariela confirmo la convencion el 2026-09-16: 1% por dia.
//     Los dias se cuentan una sola vez, desde el vencimiento de ESTE periodo,
//     y se aplican al total: los meses arrastrados no devengan aparte por su
//     propia antiguedad. Es deliberado: el numero es una estimacion para que
//     la oficina negocie, no una liquidacion de intereses.
//   • Display only — does NOT auto-create LATE_FEE_IN. The encargada
//     decides whether to charge inside the popover (toggle) and records
//     it manually via the Movs. modal.
// ============================================================================

import { createSupabaseServer } from '@/lib/supabase/server'
import { periodLabel, getArgentinaToday } from '@/lib/period'
import { getLiveRent } from '@/lib/contract/live-rent'

// 12 months back. Alejandro, 2026-09-10: "Si debe 12 meses... de alguna manera
// lo tengo que saber. Pensa que esta es la herramienta donde yo voy a depositar
// mi confianza." Was 3, which silently hid anything older than a quarter.
export const CARRYOVER_PERIODS = 12

/**
 * Corte de la deuda automatica. Nada anterior a este periodo se cuenta como
 * deuda, aunque no haya alquiler cobrado.
 *
 * Alejandro, 2026-09-11: "Agosto lo dejaria tambien como pagado, yo sigo
 * directamente con Septiembre."
 *
 * El motivo es que los meses previos nunca se cargaron del todo — Julio tiene
 * 23 alquileres de 97 contratos y Agosto ninguno — asi que la falta de una
 * fila de alquiler ahi NO prueba que el inquilino no pago. Derivar deuda de
 * esa ausencia le inventaba deuda a los ~97 contratos a la vez.
 *
 * Esto NO borra nada: las transacciones de Marzo a Agosto siguen enteras y se
 * ven igual en la planilla de esos meses, en el historial del contrato y en
 * movimientos. Lo unico que cambia es que este calculo no las mira. Mover la
 * fecha para atras vuelve a mostrar esa deuda, porque el dato nunca se toco.
 *
 * Los inquilinos que SI deben de antes se cargan a mano en `deuda_anterior`.
 */
export const DEUDA_EPOCH = '2026-09-01'

/** PostgREST returns at most ~1000 rows per request. 12 periods x ~100
 *  contracts x several transactions each blows past that, and the failure is
 *  SILENT truncation — which here would UNDER-report debt, the exact opposite
 *  of what this feature is for. So the window fetch pages explicitly. */
const PAGE_SIZE = 1000

export interface DeudaCarryoverEntry {
  /** YYYY-MM-DD start-of-month of the prior period. */
  period:        string
  periodLabel:   string
  expectedRent:  number
  cobrado:       number
  /** max(0, expectedRent - cobrado). */
  deuda:         number
  /** true = cargada a mano en `deuda_anterior` (mes anterior al corte), no
   *  derivada de la falta de un alquiler cobrado. El panel la muestra
   *  distinto: "cobrado $0 de $X" seria enganoso para un monto que la oficina
   *  afirma de sus propios registros. */
  manual?:       boolean
  /** Nota opcional que cargo la oficina junto al monto. */
  note?:         string | null
  /** Dias de atraso de ESTE mes, contados desde su propio dia 1. Un mes viejo
   *  acumula mas que uno nuevo, y por eso el interes se calcula por mes y no
   *  sobre el total. El panel lo muestra al lado de cada linea. */
  daysOverdue?:  number
}

export interface DeudaBreakdown {
  contractId:          string
  period:              string
  expectedRent:        number
  cobradoThisPeriod:   number
  deudaCurrent:        number
  carryover:           DeudaCarryoverEntry[]
  deudaCarryover:      number
  /** Days past the contract's payment_day for THIS period. 0 when not overdue. */
  daysOverdue:         number
  lateInterestEnabled: boolean
  lateInterestRate:    number
  /** Computed estimate when applied — `(deuda × rate% × daysOverdue)`, diario. */
  interesesEstimado:   number
}

/** Enumerate prior period start-of-month strings, N months back from `period`. */
export function priorPeriods(period: string, n: number): string[] {
  const [y, m] = period.split('-')
  let year  = Number(y)
  let month = Number(m)
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    month--
    if (month <= 0) { month = 12; year-- }
    out.push(`${year}-${String(month).padStart(2, '0')}-01`)
  }
  return out
}

/**
 * Interés por mora DIARIO. Devuelve 0 ante cualquier entrada no positiva.
 *
 * Mariela, vía Alejandro (2026-09-16): «El interés por atraso. Es del 1%
 * diario.» Hasta ese día esto dividía por 30 y trataba la tasa como mensual
 * —el panel decía «5% mensual»— así que mostraba la sexta parte de lo que
 * corresponde: $22.109 donde iban $132.655.
 *
 * Se pudo cambiar sin convertir ninguna decisión porque los 103 contratos
 * tenían el mismo 5.00 por defecto y ninguno tenía el interés activado. La
 * migración 2026-09-16b los pasa a 1.00 y va ANTES del deploy: con el código
 * nuevo y los datos viejos, ese 5 se leería como 5% diario.
 *
 * Sigue siendo una ESTIMACIÓN: no crea ningún LATE_FEE_IN. La oficina decide
 * si lo cobra y lo carga a mano. Alejandro: «el 1% es justamente para que no
 * se atrasen».
 */
export function computeIntereses(totalDebt: number, ratePct: number, daysOverdue: number): number {
  if (!isFinite(totalDebt) || totalDebt <= 0) return 0
  if (!isFinite(ratePct)   || ratePct   <= 0) return 0
  if (!isFinite(daysOverdue) || daysOverdue <= 0) return 0
  return Math.round(totalDebt * (ratePct / 100) * daysOverdue)
}

/**
 * Divisor del prorrateo: un mes vale SIEMPRE 31 dias, tenga los que tenga.
 *
 * No es un descuido, es lo que hace la oficina. En la rendicion que mando
 * Alejandro el 2026-09-16 (BOZZOLO / DE SANTIS, alquiler 800.000, 22 dias de
 * Septiembre) el monto cobrado es 567.741,94, y eso sale de 800.000 / 31 x 22
 * al centavo. Con 30 hubiera dado 586.666,67, que no es lo que cobraron.
 *
 * Esta en una sola constante justamente porque es la parte discutible: si algun
 * dia dicen que van por dias reales del mes, se cambia aca y en ningun otro
 * lado.
 */
export const PRORATE_DIVISOR = 31

/** Parsea 'YYYY-MM-DD' sin pasar por Date. new Date('2026-09-09') es medianoche
 *  UTC, asi que getDate() en Argentina (UTC-3) devuelve 8: un dia menos en cada
 *  prorrateo. */
function ymd(iso: string | null): { y: number; m: number; d: number } | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

/**
 * Cuanto alquiler corresponde esperar en este periodo, contando solo los dias
 * que el contrato estuvo vigente.
 *
 * EL PROBLEMA QUE RESUELVE (2026-09-16)
 *
 * Hasta hoy el sistema esperaba un mes entero SIEMPRE, incluso el mes en que el
 * inquilino recien se mudaba. Alejandro alquilo una propiedad a mitad de
 * Septiembre, cobro 22 dias, y la columna Deuda le marco ~232.000 que nadie
 * debia. Peor: el arrastre revalua cada mes anterior contra el alquiler
 * completo, asi que esa deuda inventada reaparecia en Octubre, Noviembre y
 * Diciembre — y desde esta manana devenga 1% DIARIO de interes.
 *
 * LA REGLA
 *
 * Solo se prorratea el mes en que el contrato ARRANCA o TERMINA. Un mes
 * completo devuelve el alquiler completo, sin pasar por la division: si no,
 * dividir 30 dias por 31 le recortaria un dia de alquiler a los 105 contratos
 * todos los meses.
 *
 * Los dias se cuentan inclusive en ambas puntas, igual que ellos: del 9 al 30
 * de Septiembre son 22 dias, no 21.
 */
export function proratedRentForPeriod(
  fullRent:  number,
  period:    string,
  startDate: string | null,
  endDate:   string | null,
): number {
  if (!isFinite(fullRent) || fullRent <= 0) return 0
  const p = ymd(period)
  if (!p) return fullRent
  const lastDay = new Date(p.y, p.m, 0).getDate()

  const s = ymd(startDate)
  const e = ymd(endDate)

  // Fuera de vigencia por completo: no se espera nada. En la practica la
  // planilla ya filtra estos contratos, pero si algo cambia rio arriba es
  // preferible esperar 0 antes que un mes entero de deuda fantasma.
  if (s && (s.y > p.y || (s.y === p.y && s.m > p.m))) return 0
  if (e && (e.y < p.y || (e.y === p.y && e.m < p.m))) return 0

  const startsHere = !!s && s.y === p.y && s.m === p.m
  const endsHere   = !!e && e.y === p.y && e.m === p.m
  if (!startsHere && !endsHere) return fullRent

  const from = startsHere ? Math.min(Math.max(1, s!.d), lastDay) : 1
  const to   = endsHere   ? Math.min(Math.max(1, e!.d), lastDay) : lastDay
  if (to < from) return 0
  // Entra y sale el mismo dia, o cubre el mes entero: sin prorrateo.
  if (from === 1 && to === lastDay) return fullRent

  const days = to - from + 1
  return Math.round((fullRent / PRORATE_DIVISOR) * days * 100) / 100
}

/**
 * Dias de atraso a los que se le aplica el 1% diario. 0 mientras no este vencido.
 *
 * LA MULTA SE RETROTRAE AL 1 (Alejandro, 2026-09-17)
 *
 * «La multa se retrotrae al 01 del mes. O sea, empieza a correr desde el dia 01.»
 * No hay dias de gracia: el payment_day decide SI hay multa, pero una vez vencido
 * los dias se cuentan desde el 1, asi que los dias previos al vencimiento entran
 * igual. Con vencimiento el 5 y hoy 20, son 19 dias y no 15.
 *
 * Hasta el 2026-09-17 contaba desde el vencimiento, que era la lectura
 * intuitiva pero no la de ellos: el que paga tarde no se queda con los dias de
 * gracia gratis, justamente porque la multa existe para que no se atrasen.
 *
 * No esta acotado a un mes a proposito: si Septiembre sigue impago en Noviembre,
 * los dias siguen corriendo desde el 1 de Septiembre.
 */
export function daysOverdueForPeriod(
  period: string,
  paymentDay: number,
  /** Inyectable solo para los tests; en produccion siempre es hoy en Argentina. */
  today: Date = getArgentinaToday(),
): number {
  const [yStr, mStr] = period.split('-')
  const year  = Number(yStr)
  const month = Number(mStr)
  if (!isFinite(year) || !isFinite(month)) return 0
  const lastDay = new Date(year, month, 0).getDate()
  const day     = Math.min(Math.max(1, paymentDay), lastDay)
  const due     = new Date(year, month - 1, day)
  const todayM  = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  // El vencimiento decide SI hay multa; el 1 decide DESDE CUANDO se cuenta.
  // Mientras no venza no corre nada, ni un dia.
  if (todayM.getTime() <= due.getTime()) return 0
  // Y una vez vencido, se retrotrae al 1: los dias de gracia entran tambien.
  const first = new Date(year, month - 1, 1)
  return Math.max(0, Math.floor((todayM.getTime() - first.getTime()) / 86400000))
}

/** Bulk-build breakdowns for many contracts in one Supabase round-trip. */
export async function buildDeudaBreakdownsBulk(
  contracts: Array<{
    id:                    string
    currentRent:           number
    /** Rent that actually applies THIS period (current_rent adjusted by an
     *  unapplied aumento) — the same value the planilla Alquiler cell shows.
     *  Falls back to currentRent when the caller doesn't compute it. */
    expectedRentCurrentPeriod?: number
    paymentDay:            number
    startDate:             string | null
    /** Fin de vigencia. Se usa para prorratear el ULTIMO mes: un inquilino que
     *  se va el 5 no debe el mes entero. Null = sigue vigente. */
    endDate?:              string | null
    lateInterestEnabled:   boolean
    lateInterestRate:      number
  }>,
  period: string,
): Promise<Map<string, DeudaBreakdown>> {
  const supabase = await createSupabaseServer()
  const out = new Map<string, DeudaBreakdown>()
  if (contracts.length === 0) return out

  const priors = priorPeriods(period, CARRYOVER_PERIODS)
  const allPeriods = [period, ...priors]
  const contractIds = contracts.map(c => c.id)

  // Fetch every transaction in the window (all types). RENT_IN + RENT_NF_IN
  // feed the cobrado sum; the presence of ANY transaction (of any type) marks
  // the earliest month this contract was tracked from, so we never invent debt
  // for months that predate its import.
  const txns: any[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('contract_id, amount, period, bank_date, transaction_types!inner(code)')
      .in('contract_id', contractIds)
      .in('period', allPeriods)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      // Loud on purpose. Swallowing this used to mean "no debt" — a wrong
      // answer that looks exactly like a right one.
      console.error('[buildDeudaBreakdownsBulk] transactions fetch failed:', error.message)
      break
    }
    txns.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }

  // Cobrado = RENT_IN + RENT_NF_IN que YA TIENEN fecha de banco.
  //
  // Alejandro, 2026-09-11, describiendo el circuito real: "Apenas empiezan a
  // entrar pagos, las chicas van ingresando la informacion, ponen la fecha de
  // ingreso, y todo cambia a negro". O sea: la plata esta cobrada cuando tiene
  // fecha, no cuando alguien escribio un monto. Una linea con monto y sin
  // fecha todavia no entro.
  //
  // Es el mismo criterio que ya usa el resto del sistema: conciliacion define
  // conciliado como bank_date != null, y el historial de pagos del contrato
  // marca cobrado con `if (t.bank_date)` (lib/contract/queries.ts). Antes la
  // deuda era el unico lugar que contaba el monto pelado, asi que una linea a
  // medio cargar hacia desaparecer la deuda del mes.
  const cobradoByKey = new Map<string, number>()
  // Earliest period this contract has ANY transaction for. Everything before
  // it predates the import and must not be counted as debt; everything from it
  // onward is a month the office actually worked, so a month with no rent row
  // there is genuinely unpaid — which is precisely what Alejandro asked to see.
  // (The previous rule skipped any period with no transactions at all, so a
  // month where the tenant simply paid nothing was invisible.)
  const firstTrackedPeriod = new Map<string, string>()
  for (const t of txns) {
    const key   = `${t.contract_id}|${t.period}`
    const prev  = firstTrackedPeriod.get(t.contract_id)
    if (!prev || t.period < prev) firstTrackedPeriod.set(t.contract_id, t.period)
    const ttRaw = t.transaction_types
    const code  = Array.isArray(ttRaw) ? ttRaw[0]?.code : ttRaw?.code
    if ((code === 'RENT_IN' || code === 'RENT_NF_IN') && t.bank_date) {
      cobradoByKey.set(key, (cobradoByKey.get(key) ?? 0) + (Number(t.amount) || 0))
    }
  }

  // Rent history — Alejandro, 2026-09-10: "El valor del mes viejo queda viejo".
  // Prior months must be valued at the rent in force THEN, not today's. The
  // `adjustments` table records every increase (old_rent → new_rent), so the
  // rent during a past period is the `old_rent` of the FIRST increase applied
  // at or after that period started. No increase after it → today's rent.
  //
  // Caveat, deliberate: persistAumento stamps `applied_at` with the click date,
  // not the effective date, so an increase clicked mid-month lands on that
  // month. Where that is ambiguous this resolves to the OLDER (lower) rent,
  // which under-states rather than over-states what a tenant owes.
  const adjustmentsByContract = new Map<string, Array<{ appliedAt: string; oldRent: number }>>()
  const { data: adjs, error: adjErr } = await supabase
    .from('adjustments')
    .select('contract_id, applied_at, old_rent')
    .in('contract_id', contractIds)
    .order('applied_at', { ascending: true })
  if (adjErr) console.error('[buildDeudaBreakdownsBulk] adjustments fetch failed:', adjErr.message)
  for (const a of (adjs ?? []) as any[]) {
    const list = adjustmentsByContract.get(a.contract_id) ?? []
    list.push({ appliedAt: String(a.applied_at), oldRent: Number(a.old_rent ?? 0) })
    adjustmentsByContract.set(a.contract_id, list)
  }
  const rentInForce = (contractId: string, p: string, fallback: number): number => {
    const list = adjustmentsByContract.get(contractId)
    if (!list?.length) return fallback
    const next = list.find(a => a.appliedAt >= p)   // ascending → first one at/after p
    return next ? next.oldRent : fallback
  }

  // Deuda anterior cargada a mano (una fila por contrato y mes). Es la unica
  // via para la deuda previa al corte: antes del epoch la ausencia de un
  // alquiler no prueba nada, asi que el monto lo afirma la oficina.
  // Descendente para que los meses viejos salgan en el mismo orden que los
  // automaticos (mas nuevo primero).
  const manualByContract = new Map<string, Array<{ period: string; amount: number; note: string | null }>>()
  const { data: manualRows, error: manualErr } = await supabase
    .from('deuda_anterior')
    .select('contract_id, period, amount, note')
    .in('contract_id', contractIds)
    .order('period', { ascending: false })
    .limit(PAGE_SIZE)
  if (manualErr) console.error('[buildDeudaBreakdownsBulk] deuda_anterior fetch failed:', manualErr.message)
  for (const m of (manualRows ?? []) as any[]) {
    const list = manualByContract.get(m.contract_id) ?? []
    list.push({ period: String(m.period), amount: Number(m.amount ?? 0) || 0, note: m.note ?? null })
    manualByContract.set(m.contract_id, list)
  }

  for (const c of contracts) {
    // Current period is measured against the rent that applies THIS period
    // (same value the Alquiler cell shows), so an unpaid aumento shows the right
    // debt and a cobro at the new value clears it. Prior periods are measured
    // against the rent in force in each of those months (see rentInForce).
    // ...y prorrateado cuando el contrato arranca o termina DENTRO de este mes,
    // asi un inquilino que se muda el 9 no arrastra los 8 dias previos como
    // deuda. Un mes completo pasa intacto por proratedRentForPeriod.
    const expectedCurrent   = proratedRentForPeriod(
      c.expectedRentCurrentPeriod ?? c.currentRent, period, c.startDate, c.endDate ?? null,
    )
    const cobradoThisPeriod = cobradoByKey.get(`${c.id}|${period}`) ?? 0
    const deudaCurrent = Math.max(0, expectedCurrent - cobradoThisPeriod)

    const carryover: DeudaCarryoverEntry[] = []
    const floor = firstTrackedPeriod.get(c.id)
    for (const p of priors) {
      if (c.startDate && p < c.startDate) continue
      // Before the contract's first recorded month = never imported, not
      // unpaid. Counting those invented huge phantom debt (a contract loaded
      // only from May showed Mar/Apr fully unpaid). From that month onward a
      // period with no rent row IS a genuinely unpaid month and counts.
      if (!floor || p < floor) continue
      // Corte: antes del epoch la deuda no se deriva, se carga a mano.
      if (p < DEUDA_EPOCH) continue
      const cobrado      = cobradoByKey.get(`${c.id}|${p}`) ?? 0
      // El MISMO prorrateo que el mes corriente. Sin esto el arreglo duraba un
      // mes: Septiembre cerraba bien en Septiembre y volvia a figurar impago en
      // Octubre, porque el arrastre lo revaluaba contra el alquiler entero.
      const expectedThen = proratedRentForPeriod(
        rentInForce(c.id, p, c.currentRent), p, c.startDate, c.endDate ?? null,
      )
      const deuda        = Math.max(0, expectedThen - cobrado)
      carryover.push({
        period:       p,
        periodLabel:  periodLabel(p),
        expectedRent: expectedThen,
        cobrado,
        deuda,
      })
    }
    // Deuda anterior a mano. Va DESPUES de los meses automaticos porque es
    // siempre mas vieja que el corte, y el panel lista de mas nuevo a mas
    // viejo. Se saltea un mes que ya tenga fila automatica para no contarlo
    // dos veces, y el periodo corriente porque ese ya es deudaCurrent.
    const autoPeriods = new Set(carryover.map(e => e.period))
    for (const m of manualByContract.get(c.id) ?? []) {
      if (m.amount <= 0)            continue
      if (m.period >= period)       continue
      if (autoPeriods.has(m.period)) continue
      carryover.push({
        period:       m.period,
        periodLabel:  periodLabel(m.period),
        expectedRent: m.amount,
        cobrado:      0,
        deuda:        m.amount,
        manual:       true,
        note:         m.note,
      })
    }

    const deudaCarryover = carryover.reduce((s, e) => s + e.deuda, 0)

    const daysOverdue = daysOverdueForPeriod(period, c.paymentDay)

    // Cada mes envejece por su cuenta (2026-09-17). Un mes viejo acumulo mas
    // dias que uno nuevo, asi que cobrarle a todo la misma cantidad de dias
    // -- los del mes corriente -- le cobraba a Febrero como si fuera de ayer.
    //
    // Es como lo hace la planilla de la oficina, verificado contra el caso real
    // que mando Alejandro: Febrero 109 dias, Marzo 81, Abril 50, Mayo 20, todos
    // cerrando el mismo dia. Con 100.000 por mes eso da 260.000 de interes;
    // sumando los cuatro meses en una sola bolsa daba 64.000.
    //
    // daysOverdueForPeriod ya sabe contar desde el 1 de CUALQUIER mes, asi que
    // sirve igual para el mes corriente y para los arrastrados.
    for (const e of carryover) {
      e.daysOverdue = daysOverdueForPeriod(e.period, c.paymentDay)
    }
    const totalDebt         = deudaCurrent + deudaCarryover
    const interesesEstimado =
      computeIntereses(deudaCurrent, c.lateInterestRate, daysOverdue) +
      carryover.reduce(
        (s, e) => s + computeIntereses(e.deuda, c.lateInterestRate, e.daysOverdue ?? 0),
        0,
      )

    out.set(c.id, {
      contractId:          c.id,
      period,
      expectedRent:        expectedCurrent,
      cobradoThisPeriod,
      deudaCurrent,
      carryover,
      deudaCarryover,
      daysOverdue,
      lateInterestEnabled: c.lateInterestEnabled,
      lateInterestRate:    c.lateInterestRate,
      interesesEstimado,
    })
  }
  return out
}

/** Single-contract breakdown — used by the contract detail page. */
export async function getDeudaBreakdown(
  contractId: string,
  period:     string,
): Promise<DeudaBreakdown | null> {
  const supabase = await createSupabaseServer()
  const { data: c } = await supabase
    .from('contracts')
    .select('id, current_rent, payment_day, start_date, end_date, cadence, last_adjustment_date, created_at, late_interest_enabled, late_interest_rate')
    .eq('id', contractId)
    .maybeSingle()
  if (!c) return null

  // Current-period expected = the LIVE rent (current_rent carried forward by
  // IPC), the same value the planilla + contract page show.
  const expectedRentCurrentPeriod = await getLiveRent({
    id:                 (c as any).id,
    currentRent:        Number((c as any).current_rent ?? 0),
    cadence:            (c as any).cadence ?? null,
    startDate:          (c as any).start_date ?? null,
    lastAdjustmentDate: (c as any).last_adjustment_date ?? null,
    createdAt:          (c as any).created_at ?? null,
  }, period)

  const map = await buildDeudaBreakdownsBulk(
    [{
      id:                  (c as any).id,
      currentRent:         Number((c as any).current_rent ?? 0),
      expectedRentCurrentPeriod,
      paymentDay:          Number((c as any).payment_day ?? 5),
      startDate:           (c as any).start_date ?? null,
      endDate:             (c as any).end_date ?? null,
      lateInterestEnabled: (c as any).late_interest_enabled === true,
      lateInterestRate:    Number((c as any).late_interest_rate ?? 0),
    }],
    period,
  )
  return map.get((c as any).id) ?? null
}
