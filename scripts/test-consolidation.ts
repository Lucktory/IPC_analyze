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
import { recurringChargeAppliesToPeriod, cuotaNumberFor } from '../lib/contract/recurring-charges-bulk'
import {
  computeIntereses, proratedRentForPeriod, daysOverdueForPeriod, applyCreditForward,
} from '../lib/liquidacion/deuda-breakdown'
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

// ── Recordatorios finitos (cuotas) — 2026-09-16 ─────────────────────────────
// Alejandro: "que el sistema me diga al mes siguiente que la cuota 2 de 3 hay
// que cobrarla. Y luego la 3 de 3."
console.log('\n# recurringChargeAppliesToPeriod / cuotaNumberFor')
const P = (m: string) => `2026-${m}-01`

// Sin cuotasTotal se comporta como siempre: no termina nunca.
check('sin final, mes de inicio',  recurringChargeAppliesToPeriod(P('09'), 1, P('09')))
check('sin final, un año después', recurringChargeAppliesToPeriod(P('09'), 1, '2027-09-01'))
check('antes del inicio → no',     !recurringChargeAppliesToPeriod(P('09'), 1, P('08')))
// start_period null = recargo viejo sin desde-cuándo: aplica siempre. Esta es
// la regresión que casi introduzco al delegar en cuotaNumberFor sin más.
check('legacy sin start_period aplica', recurringChargeAppliesToPeriod(null, 1, P('01')))

// Con 3 cuotas mensuales desde Septiembre: Sep, Oct, Nov — y se apaga.
check('cuota 1 (Sep)', recurringChargeAppliesToPeriod(P('09'), 1, P('09'), 3))
check('cuota 2 (Oct)', recurringChargeAppliesToPeriod(P('09'), 1, P('10'), 3))
check('cuota 3 (Nov)', recurringChargeAppliesToPeriod(P('09'), 1, P('11'), 3))
check('Dic ya no: terminó', !recurringChargeAppliesToPeriod(P('09'), 1, P('12'), 3))

eq('nº de cuota en Sep', cuotaNumberFor(P('09'), 1, P('09'), 3), 1)
eq('nº de cuota en Oct', cuotaNumberFor(P('09'), 1, P('10'), 3), 2)
eq('nº de cuota en Nov', cuotaNumberFor(P('09'), 1, P('11'), 3), 3)
eq('después del final → null', cuotaNumberFor(P('09'), 1, P('12'), 3), null)

// Bimestral: cuenta CUOTAS, no meses. 3 cuotas desde Sep = Sep, Nov, Ene.
check('bimestral cuota 2 cae en Nov',  recurringChargeAppliesToPeriod(P('09'), 2, P('11'), 3))
check('bimestral saltea Octubre',     !recurringChargeAppliesToPeriod(P('09'), 2, P('10'), 3))
eq('bimestral: Nov es la cuota 2',     cuotaNumberFor(P('09'), 2, P('11'), 3), 2)
eq('bimestral: Ene es la cuota 3',     cuotaNumberFor(P('09'), 2, '2027-01-01', 3), 3)
check('bimestral: Mar ya terminó',    !recurringChargeAppliesToPeriod(P('09'), 2, '2027-03-01', 3))

// Los 12 meses de expensas extraordinarias de Alassia, el otro caso que esto
// resuelve: arranca en Septiembre y la última es Agosto del año siguiente.
check('expensas extraordinarias: mes 12',  recurringChargeAppliesToPeriod(P('09'), 1, '2027-08-01', 12))
check('expensas extraordinarias: mes 13 no', !recurringChargeAppliesToPeriod(P('09'), 1, '2027-09-01', 12))

// ── Interés por mora: DIARIO (2026-09-16) ───────────────────────────────────
// Mariela, vía Alejandro: «el interés por atraso es del 1% diario». Antes esto
// dividía por 30 y trataba la tasa como mensual, mostrando la sexta parte.
console.log('\n# computeIntereses — tasa diaria')
eq('1% diario, 1 día',   computeIntereses(100000, 1, 1),   1000)
eq('1% diario, 10 días', computeIntereses(100000, 1, 10), 10000)
eq('1% diario, 30 días', computeIntereses(100000, 1, 30), 30000)
// El caso real de la pantalla de Alejandro: 2.653.114 con 5 días de atraso.
// Con la fórmula vieja (5% mensual) daba 22.109; al 1% diario son 132.656.
eq('caso real: 5 días al 1%', computeIntereses(2653114, 1, 5), 132656)
// Guardas: cualquier entrada no positiva da 0, nunca un número raro.
eq('deuda 0',        computeIntereses(0, 1, 5),        0)
eq('tasa 0',         computeIntereses(100000, 0, 5),   0)
eq('sin atraso',     computeIntereses(100000, 1, 0),   0)
eq('días negativos', computeIntereses(100000, 1, -3),  0)
check('crece con los días', computeIntereses(100000, 1, 10) > computeIntereses(100000, 1, 9))

// ── Prorrateo del primer y ultimo mes (2026-09-16) ──────────────────────────
// Alejandro alquilo una propiedad a mitad de Septiembre: el inquilino pago 22
// dias y la columna Deuda le marcaba ~232.000 que nadie debia.
console.log('\n# proratedRentForPeriod — prorrateo de entrada y salida')
const SEP = '2026-09-01'

// EL caso real, el que tiene que dar exacto: su rendicion BOZZOLO / DE SANTIS.
// 800.000 / 31 x 22 = 567.741,94. Con 30 daria 586.666,67, que NO es lo que
// cobraron — por eso PRORATE_DIVISOR es 31.
eq('22 dias de Septiembre (entra el 9)', proratedRentForPeriod(800000, SEP, '2026-09-09', null), 567741.94)

// El mes entero NO se prorratea: dividir 30 por 31 le recortaria un dia de
// alquiler a los 105 contratos todos los meses. Esta es la regresion a evitar.
eq('mes completo intacto',        proratedRentForPeriod(800000, SEP, '2025-01-01', null), 800000)
eq('mes completo sin fechas',     proratedRentForPeriod(800000, SEP, null, null), 800000)
eq('entra el 1 = mes completo',   proratedRentForPeriod(800000, SEP, '2026-09-01', null), 800000)
eq('se va el 30 = mes completo',  proratedRentForPeriod(800000, SEP, null, '2026-09-30'), 800000)

// El ejemplo que planteo el usuario: entra 15-sep, se va 5-dic.
eq('entra el 15 de Sep', proratedRentForPeriod(800000, SEP, '2026-09-15', '2026-12-05'), 412903.23)
eq('Octubre entero',     proratedRentForPeriod(800000, '2026-10-01', '2026-09-15', '2026-12-05'), 800000)
eq('Noviembre entero',   proratedRentForPeriod(800000, '2026-11-01', '2026-09-15', '2026-12-05'), 800000)
eq('se va el 5 de Dic',  proratedRentForPeriod(800000, '2026-12-01', '2026-09-15', '2026-12-05'), 129032.26)

// Fuera de vigencia: ni un peso esperado, nunca un mes entero de deuda fantasma.
eq('antes de empezar', proratedRentForPeriod(800000, SEP, '2026-10-01', null), 0)
eq('despues de irse',  proratedRentForPeriod(800000, SEP, null, '2026-08-31'), 0)

// Entra y sale dentro del mismo mes: solo esos dias.
eq('del 10 al 20 = 11 dias', proratedRentForPeriod(800000, SEP, '2026-09-10', '2026-09-20'), 283870.97)

// Guardas.
eq('alquiler 0',        proratedRentForPeriod(0, SEP, '2026-09-09', null), 0)
eq('periodo invalido',  proratedRentForPeriod(800000, 'nope', '2026-09-09', null), 800000)
check('prorrateado < mes entero', proratedRentForPeriod(800000, SEP, '2026-09-09', null) < 800000)

// ── La multa se retrotrae al 1 (2026-09-17) ─────────────────────────────────
// Alejandro: «la multa se retrotrae al 01 del mes. O sea, empieza a correr
// desde el dia 01.» El vencimiento decide SI hay multa; el 1 decide desde
// cuando se cuenta. No hay dias de gracia gratis.
console.log('\n# daysOverdueForPeriod — se retrotrae al 1')
const D = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }

// Vencimiento el 5 de Septiembre.
eq('el 1, ni vencido',        daysOverdueForPeriod(SEP, 5, D('2026-09-01')), 0)
eq('el 4, vispera',           daysOverdueForPeriod(SEP, 5, D('2026-09-04')), 0)
eq('el 5, dia del vencimiento', daysOverdueForPeriod(SEP, 5, D('2026-09-05')), 0)
// Al dia siguiente ya corre, y arranca contando desde el 1: NO es 1 dia.
eq('el 6, primer dia vencido', daysOverdueForPeriod(SEP, 5, D('2026-09-06')), 5)
eq('el 20 son 19, no 15',      daysOverdueForPeriod(SEP, 5, D('2026-09-20')), 19)

// Sigue corriendo mes a mes mientras no paguen.
eq('Septiembre impago al 10 de Octubre', daysOverdueForPeriod(SEP, 5, D('2026-10-10')), 39)

// payment_day fuera de rango se acota al ultimo dia del mes (Septiembre = 30).
eq('payment_day 31 en Septiembre', daysOverdueForPeriod(SEP, 31, D('2026-09-30')), 0)
eq('...y al dia siguiente',        daysOverdueForPeriod(SEP, 31, D('2026-10-01')), 30)

// Los dias alimentan el interes: al 1% diario, 19 dias sobre 100.000 = 19.000.
eq('interes con la regla nueva',
   computeIntereses(100000, 1, daysOverdueForPeriod(SEP, 5, D('2026-09-20'))), 19000)

// ── Cada mes envejece por su cuenta ─────────────────────────────────────────
// La planilla de la oficina cuenta los dias de CADA mes adeudado desde su
// propio dia 1: en el caso real que mando Alejandro, Febrero 109 dias, Marzo
// 81, Abril 50 y Mayo 20, los cuatro cerrando el 21 de mayo.
console.log('\n# deuda vieja: un conteo de dias por mes')
const CORTE = D('2026-05-21')
eq('Febrero al 21/5', daysOverdueForPeriod('2026-02-01', 5, CORTE), 109)
eq('Marzo al 21/5',   daysOverdueForPeriod('2026-03-01', 5, CORTE), 81)
eq('Abril al 21/5',   daysOverdueForPeriod('2026-04-01', 5, CORTE), 50)
eq('Mayo al 21/5',    daysOverdueForPeriod('2026-05-01', 5, CORTE), 20)

// Y ese conteo por mes es lo que cambia el total. Con 100.000 por mes:
const meses = ['2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01']
const porMes = meses.reduce(
  (s, p) => s + computeIntereses(100000, 1, daysOverdueForPeriod(p, 5, CORTE)), 0)
eq('sumando mes por mes', porMes, 260000)
// Lo que hacia antes: toda la deuda junta con los dias del mes corriente.
eq('todo junto con los dias de Mayo', computeIntereses(400000, 1, 20), 80000)
check('el conteo por mes cobra mas que el viejo', porMes > 80000)

// El capital no lo toca nada de esto: solo cambia el interes.
eq('capital intacto', 100000 * 4, 400000)

// ── Saldo a favor: el que paga de mas (2026-09-17) ──────────────────────────
// Alejandro: "si el importe estandar menos el pago es mayor que cero es deuda;
// si no, es saldo a favor que se arrastra. Si un mes no paga, se le descuenta
// del saldo ANTES de calcular el interes diario."
console.log('\n# applyCreditForward — el saldo a favor se arrastra')
const M = (m: string, expected: number, cobrado: number) =>
  ({ period: `2026-${m}-01`, expected, cobrado })

// EL caso: alquiler 500.000, paga 600.000 tres meses y el cuarto no paga.
// Debia 500.000, tenia 300.000 a favor -> queda debiendo 200.000.
const caso = applyCreditForward([
  M('09', 500000, 600000),
  M('10', 500000, 600000),
  M('11', 500000, 600000),
  M('12', 500000,      0),
])
eq('Sep sin deuda', caso.deudaPorMes.get('2026-09-01'), 0)
eq('Oct sin deuda', caso.deudaPorMes.get('2026-10-01'), 0)
eq('Nov sin deuda', caso.deudaPorMes.get('2026-11-01'), 0)
eq('Dic debe 200.000, no 500.000', caso.deudaPorMes.get('2026-12-01'), 200000)
eq('no sobra saldo', caso.saldoAFavor, 0)
// Y el interes, que es el punto: 10 dias al 1% sobre 200.000, no sobre 500.000.
eq('interes sobre lo que debe de verdad',
   computeIntereses(caso.deudaPorMes.get('2026-12-01') ?? 0, 1, 10), 20000)
eq('...contra lo que daba antes', computeIntereses(500000, 1, 10), 50000)

// Paga de mas y nunca deja de pagar: todo queda a favor.
const soloFavor = applyCreditForward([M('09', 500000, 600000), M('10', 500000, 600000)])
eq('dos meses de mas = 200.000 a favor', soloFavor.saldoAFavor, 200000)
check('sin deuda en ningun mes',
  [...soloFavor.deudaPorMes.values()].every(v => v === 0))

// El saldo alcanza de sobra: cubre el mes entero y todavia queda vuelto.
// (Paga 1.100.000 sobre un alquiler de 500.000 -> 600.000 a favor; el mes
//  siguiente no paga nada, se le descuentan 500.000 y le quedan 100.000.)
const sobra = applyCreditForward([M('09', 500000, 1100000), M('10', 500000, 0)])
eq('Oct cubierto por el saldo', sobra.deudaPorMes.get('2026-10-01'), 0)
eq('y sobran 100.000', sobra.saldoAFavor, 100000)

// Y el borde exacto: el saldo cubre justo, ni deuda ni sobrante.
const justo = applyCreditForward([M('09', 500000, 1000000), M('10', 500000, 0)])
eq('cubre justo: sin deuda',    justo.deudaPorMes.get('2026-10-01'), 0)
eq('cubre justo: sin sobrante', justo.saldoAFavor, 0)

// Y cuando NO alcanza, queda debiendo la diferencia: 400.000 a favor contra un
// mes de 500.000 deja 100.000 de deuda, no cero.
const noAlcanza = applyCreditForward([M('09', 500000, 900000), M('10', 500000, 0)])
eq('saldo insuficiente: debe la diferencia', noAlcanza.deudaPorMes.get('2026-10-01'), 100000)
eq('saldo insuficiente: no sobra nada',      noAlcanza.saldoAFavor, 0)

// Sin saldo previo nada cambia: la deuda es la de siempre.
const sinSaldo = applyCreditForward([M('09', 500000, 500000), M('10', 500000, 0)])
eq('paga justo: sin deuda', sinSaldo.deudaPorMes.get('2026-09-01'), 0)
eq('no paga: debe todo',    sinSaldo.deudaPorMes.get('2026-10-01'), 500000)
eq('sin saldo a favor',     sinSaldo.saldoAFavor, 0)

// El saldo va hacia ADELANTE, no hacia atras: un mes impago ANTES del
// excedente sigue siendo deuda. Por eso el recorrido es cronologico.
const haciaAdelante = applyCreditForward([M('09', 500000, 0), M('10', 500000, 900000)])
eq('el mes viejo sigue debiendo', haciaAdelante.deudaPorMes.get('2026-09-01'), 500000)
eq('y el excedente queda a favor', haciaAdelante.saldoAFavor, 400000)

// Da igual en que orden lleguen los meses: ordena antes de recorrer.
const desordenado = applyCreditForward([
  M('12', 500000, 0), M('09', 500000, 600000), M('11', 500000, 600000), M('10', 500000, 600000),
])
eq('desordenado da lo mismo', desordenado.deudaPorMes.get('2026-12-01'), 200000)

// Pago parcial: cubre una parte y el resto queda debiendo.
const parcial = applyCreditForward([M('09', 500000, 300000)])
eq('pago parcial', parcial.deudaPorMes.get('2026-09-01'), 200000)
eq('no genera saldo', parcial.saldoAFavor, 0)

// Lista vacia: ni explota ni inventa nada.
const vacio = applyCreditForward([])
eq('sin meses: saldo 0', vacio.saldoAFavor, 0)
eq('sin meses: sin filas', vacio.deudaPorMes.size, 0)

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
