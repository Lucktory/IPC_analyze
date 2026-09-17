// ============================================================================
// RendicionSheet — el papel que recibe el propietario.
//
// Reproduce la planilla que la oficina venia armando a mano en Excel
// (Alejandro mando tres ejemplos reales el 2026-09-16). La estructura es suya,
// no nuestra, y por eso se respeta al pie de la letra:
//
//   encabezado con logo y datos de la inmobiliaria · FECHA
//   PROPIETARIO / INQUILINO
//   dos columnas: INGRESOS a la izquierda, DEDUCCIONES a la derecha
//   TOTAL INGRESADO · TOTAL DEDUCIDO · TOTAL A RENDIR
//
// Los tres ejemplos se verificaron contra el embudo del sistema y dan
// identicos hasta el centavo, asi que esto es presentacion pura: no calcula
// nada que no calcule ya lib/liquidacion/funnel.ts.
//
// CO-PROPIEDAD
//
// El tercer ejemplo (SIMOES ADRIAN / JUAN, 50/50) muestra la convencion de la
// oficina: UNA sola hoja por contrato, con una linea por dueño abajo de
// TOTAL DEDUCIDO, y TOTAL A RENDIR con el monto entero. O sea que el documento
// nunca elige "el" propietario — los lista a todos. Por eso este componente
// toma landlordsList y no un unico landlord.
//
// AJUSTES
//
// La planilla de ellos no tiene el concepto. Un ajuste positivo entra como
// ingreso y uno negativo como deduccion, que es lo unico que mantiene
// TOTAL INGRESADO - TOTAL DEDUCIDO == neto al propietario.
// ============================================================================

import { fmtMoney } from '@/lib/format'
import { periodLabel } from '@/lib/period'
import { stripOtrosMarker } from '@/lib/transaction/managed-rows'
import type { LiquidacionDetailLine } from '@/lib/liquidacion/queries'
import type { AjusteLine } from '@/lib/contract/events-bulk'

interface Props {
  period:        string
  tenantName:    string
  landlordsList: { id: string; name: string; ownershipPct: number }[]
  lines:         LiquidacionDetailLine[]
  comisionAdmin: number
  ajusteLines:   AjusteLine[]
  /** liquidaciones.sent_at — la fecha del papel es el dia que se mando.
   *  Alejandro, 2026-09-16: "la fecha es cuando se manda la rendicion".
   *  Null mientras sigue en Borrador: ahi vale hoy, que es el dia en que se
   *  esta por mandar. Asi una reimpresion futura conserva la fecha original
   *  en lugar de correrse al dia en que se volvio a abrir. */
  sentAt:        string | null
  /** Hoy en Argentina, calculado en el server para no depender del reloj del
   *  navegador ni romper la hidratacion. */
  todayISO:      string
  /**
   * Lo que el inquilino pago DE MAS este mes, o sea lo que queda a cuenta del
   * siguiente. 0 cuando pago justo o de menos.
   *
   * No es una linea extra: es la MISMA linea de alquiler partida en dos, tal
   * cual la arma la oficina a mano ("SALDO SEPTIEMBRE" + "A CTA OCTUBRE" en la
   * planilla de Carrili). El total no se mueve, y por eso sigue cerrando contra
   * las transacciones reales.
   *
   * La oficina no hace nada distinto: carga el pago como siempre, en un solo
   * monto, y la hoja lo separa sola.
   */
  aCuentaProximo: number
}

/** Nombre del mes siguiente al periodo, para la etiqueta "A CUENTA <mes>". */
function mesSiguiente(period: string): string {
  const [y, m] = period.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return periodLabel(next).split(' ')[0].toUpperCase()
}

/** Una fila de cualquiera de las dos columnas. */
interface SheetRow { label: string; amount: number }

/** Minimo de filas por columna, para que la hoja salga siempre del mismo alto
 *  y se parezca al Excel aunque el mes tenga un solo movimiento. */
const MIN_ROWS = 6

export function RendicionSheet({
  period, tenantName, landlordsList, lines, comisionAdmin, ajusteLines, sentAt, todayISO,
  aCuentaProximo,
}: Props) {
  const fecha = new Date(sentAt ?? todayISO)
  const dd    = String(fecha.getDate()).padStart(2, '0')
  const mm    = String(fecha.getMonth() + 1).padStart(2, '0')
  const yyyy  = String(fecha.getFullYear())

  const mes = periodLabel(period).split(' ')[0].toUpperCase()

  // ── INGRESOS ──
  const ingresos: SheetRow[] = []
  for (const l of lines) {
    if (!l.affectsLiquidacion || l.direction !== 'IN') continue
    const desc = stripOtrosMarker((l.description ?? '').trim() || null)
    ingresos.push({
      label:  (desc ?? `${l.typeLabel} ${mes}`).toUpperCase(),
      amount: l.amount,
    })
  }
  for (const a of ajusteLines) {
    if (a.amount > 0) ingresos.push({ label: a.label.toUpperCase(), amount: a.amount })
  }

  // Pago de mas: se parte la linea de alquiler en dos. Se le descuenta el
  // excedente a la linea mas grande de alquiler -- que es de donde salio -- y se
  // agrega la de "a cuenta". La suma queda igual, asi que TOTAL INGRESADO no se
  // mueve y la hoja sigue cerrando contra los movimientos cargados.
  if (aCuentaProximo > 0 && ingresos.length > 0) {
    let mayor = 0
    for (let i = 1; i < ingresos.length; i++) {
      if (ingresos[i].amount > ingresos[mayor].amount) mayor = i
    }
    if (ingresos[mayor].amount > aCuentaProximo) {
      ingresos[mayor] = {
        ...ingresos[mayor],
        amount: Math.round((ingresos[mayor].amount - aCuentaProximo) * 100) / 100,
      }
      ingresos.push({ label: `A CUENTA ${mesSiguiente(period)}`, amount: aCuentaProximo })
    }
  }

  // ── DEDUCCIONES ──
  const deducciones: SheetRow[] = []
  if (comisionAdmin > 0) deducciones.push({ label: 'ADMINISTRACION', amount: comisionAdmin })
  for (const l of lines) {
    if (!l.affectsLiquidacion || l.direction !== 'OUT') continue
    if (l.typeCode === 'COMMISSION_OUT') continue   // ya tiene su propia linea
    if (l.typeCode === 'LANDLORD_PAYOUT') continue  // la transferencia NO es un descuento
    const desc = stripOtrosMarker((l.description ?? '').trim() || null)
    deducciones.push({ label: (desc ?? l.typeLabel).toUpperCase(), amount: l.amount })
  }
  for (const a of ajusteLines) {
    if (a.amount < 0) deducciones.push({ label: a.label.toUpperCase(), amount: Math.abs(a.amount) })
  }

  const totalIngresado = ingresos.reduce((s, r) => s + r.amount, 0)
  const totalDeducido  = deducciones.reduce((s, r) => s + r.amount, 0)
  const totalARendir   = totalIngresado - totalDeducido

  // Una linea por dueño, solo para los que efectivamente cobran.
  //
  // El 0% existe para decir "esta persona va en el contrato porque tiene que
  // recibir el mail, pero no le corresponde plata" (Alejandro, 2026-09-17: la
  // hija de Andrade, o el hermano mientras se acomoda la sucesion). Imprimirle
  // una linea en $0,00 al propietario seria ruido; sigue figurando arriba, en
  // PROPIETARIO, que es donde corresponde.
  //
  // Con un solo cobrando tampoco se reparte: la hoja de ellos no repite el
  // total, va directo a TOTAL A RENDIR.
  const cobran  = landlordsList.filter(l => l.ownershipPct > 0)
  const reparto = cobran.length > 1
    ? cobran.map(l => ({
        name:   l.name.toUpperCase(),
        amount: Math.round(totalARendir * (l.ownershipPct / 100) * 100) / 100,
      }))
    : []

  const filas  = Math.max(ingresos.length, deducciones.length + reparto.length, MIN_ROWS)
  const padIn  = Math.max(0, filas - ingresos.length)
  const padOut = Math.max(0, filas - deducciones.length - reparto.length)

  return (
    <div className="rendicion bg-white text-black border-2 border-black max-w-[860px] text-[12px] leading-tight">
      {/* ── Encabezado: logo + datos de la inmobiliaria ── */}
      <div className="flex items-start gap-4 p-4 border-b-2 border-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Patagonia Propiedades" className="w-[190px] h-auto shrink-0" />
        <div className="pt-1">
          <span className="inline-block border border-black px-3 py-0.5 font-semibold tracking-wide mb-2">
            RENDICION
          </span>
          <p>Mitre 674</p>
          <p>Tel (0297) 444-4862 &nbsp;-&nbsp; 4441695</p>
          <p>(9000) Comodoro Rivadavia - Chubut</p>
          <p>e-mail: patagoniainmo@gmail.com</p>
        </div>
      </div>

      {/* ── FECHA ── */}
      <div className="flex border-b-2 border-black">
        <div className="flex-1 px-3 py-1.5" />
        <div className="px-3 py-1.5 border-l-2 border-black font-semibold">FECHA</div>
        <div className="w-16 px-3 py-1.5 border-l-2 border-black text-center tabular-nums">{dd}</div>
        <div className="w-16 px-3 py-1.5 border-l-2 border-black text-center tabular-nums">{mm}</div>
        <div className="w-20 px-3 py-1.5 border-l-2 border-black text-center tabular-nums">{yyyy}</div>
      </div>

      {/* ── Partes ── */}
      <div className="px-3 py-2 border-b-2 border-black">
        <p>
          <span className="font-semibold">PROPIETARIO:&nbsp;</span>
          {landlordsList.map(l => l.name.toUpperCase()).join(' / ') || '(sin propietario)'}
        </p>
        <p>
          <span className="font-semibold">INQUILINO:&nbsp;</span>
          {tenantName.toUpperCase()}
        </p>
      </div>

      {/* ── Dos columnas ── */}
      <div className="grid grid-cols-2">
        {/* INGRESOS */}
        <div className="border-r-2 border-black">
          <div className="text-center font-semibold py-1 border-b border-black">INGRESOS</div>
          {ingresos.map((r, i) => <Row key={`in-${i}`} label={r.label} amount={r.amount} />)}
          {Array.from({ length: padIn }).map((_, i) => <Row key={`inpad-${i}`} label="" amount={null} />)}
          <div className="flex border-t-2 border-black font-semibold">
            <div className="flex-1 px-2 py-1 text-center">TOTAL INGRESADO</div>
            <div className="w-[130px] px-2 py-1 text-right tabular-nums border-l border-black">
              {fmtMoney(totalIngresado, 2)}
            </div>
          </div>
        </div>

        {/* DEDUCCIONES */}
        <div>
          <div className="text-center font-semibold py-1 border-b border-black">DEDUCCIONES</div>
          {deducciones.map((r, i) => <Row key={`out-${i}`} label={r.label} amount={r.amount} />)}
          {Array.from({ length: padOut }).map((_, i) => <Row key={`outpad-${i}`} label="" amount={null} />)}
          <div className="flex border-t border-black font-semibold">
            <div className="flex-1 px-2 py-1 text-center">TOTAL DEDUCIDO</div>
            <div className="w-[130px] px-2 py-1 text-right tabular-nums border-l border-black">
              {fmtMoney(totalDeducido, 2)}
            </div>
          </div>
          {/* Reparto entre co-propietarios — el sombreado replica el de su Excel. */}
          {reparto.map(r => (
            <div key={r.name} className="flex border-t border-black bg-[#E4DFEC] font-semibold">
              <div className="flex-1 px-2 py-1 text-center">{r.name}</div>
              <div className="w-[130px] px-2 py-1 text-right tabular-nums border-l border-black">
                {fmtMoney(r.amount, 2)}
              </div>
            </div>
          ))}
          <div className={`flex border-t-2 border-black font-bold ${reparto.length > 0 ? 'bg-[#E4DFEC]' : ''}`}>
            <div className="flex-1 px-2 py-1 text-center">TOTAL A RENDIR</div>
            <div className="w-[130px] px-2 py-1 text-right tabular-nums border-l border-black">
              {fmtMoney(totalARendir, 2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Fila simple de una columna. `amount === null` deja la fila en blanco, que es
 *  como la oficina deja el Excel: el cuadro mantiene su alto. */
function Row({ label, amount }: { label: string; amount: number | null }) {
  return (
    <div className="flex border-b border-black/40 min-h-[24px]">
      <div className="flex-1 px-2 py-1 text-center">{label}</div>
      <div className="w-[130px] px-2 py-1 text-right tabular-nums border-l border-black/40">
        {amount == null ? '' : fmtMoney(amount, 2)}
      </div>
    </div>
  )
}
