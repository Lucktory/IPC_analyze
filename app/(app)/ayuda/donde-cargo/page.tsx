import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { GuideCard, Callout } from '@/components/ayuda/guide-ui'

export const metadata = { title: '¿Dónde cargo cada cosa? — Ayuda' }

// Pedido de Alejandro (2026-09-15): "Quizas lo que podemos reforzar es el
// instructivo en Ayuda, asi los chicos saben para que sirve Extras, Movs,
// Expensas, Observaciones y Otros."
//
// La Referencia ya lista las columnas con una linea cada una, pero contesta
// "que es esta columna" y no "donde cargo esto", que es la pregunta que
// realmente tienen delante de la planilla. Esta guia va al reves: arranca de la
// situacion real y te dice a donde va.
//
// Cada confusion que aparece aca es una que paso de verdad esta semana:
// Recordatorios leido como plata cobrada, Otros confundido con un ingreso, el
// mismo gasto cargado dos veces (celda + Movs.), y la columna Expensas tomada
// por las expensas cobradas.

/** Una fila de la tabla "que paso -> donde va". */
function Caso({ situacion, donde, efecto }: { situacion: string; donde: string; efecto: string }) {
  return (
    <tr className="border-b border-line/60 align-top">
      <td className="px-2 py-2 text-slate-dark leading-relaxed">{situacion}</td>
      <td className="px-2 py-2 text-ink font-medium whitespace-nowrap">{donde}</td>
      <td className="px-2 py-2 text-slate-dark leading-relaxed">{efecto}</td>
    </tr>
  )
}

export default function DondeCargoPage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-auto pb-6 max-w-3xl">
      <BreadcrumbTitle name="¿Dónde cargo cada cosa?" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <Link href="/ayuda" className="hover:text-ink transition-colors">Ayuda</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">¿Dónde cargo cada cosa?</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">¿Dónde cargo cada cosa?</h1>
        <p className="text-[13.5px] text-slate-dark mt-1">
          Para qué sirve cada columna de la planilla y cuál usar en cada caso. Si tenés algo en la mano
          y no sabés dónde va, buscalo en la tabla de acá abajo.
        </p>
      </header>

      <Callout tone="tip" title="La regla de oro">
        Antes de cargar algo, preguntate una sola cosa: <strong className="text-ink">¿entra plata,
        sale plata, o no se mueve nada?</strong> Con eso ya sabés la columna.
      </Callout>

      {/* 1 — la tabla de decisión */}
      <GuideCard title="1. Buscá tu caso" tint="#0891B2">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="label-cap font-medium text-slate px-2 py-2">Lo que pasó</th>
                <th className="label-cap font-medium text-slate px-2 py-2 whitespace-nowrap">Va en</th>
                <th className="label-cap font-medium text-slate px-2 py-2">Qué efecto tiene</th>
              </tr>
            </thead>
            <tbody>
              <Caso situacion="El inquilino pagó el alquiler"
                    donde="Alquiler"
                    efecto="Entra plata. Se le cobra la administración y el resto va al propietario." />
              <Caso situacion="Pagó una parte nomás"
                    donde="Alquiler"
                    efecto="Cargás lo que pagó. Abajo del monto te avisa en rojo cuánto falta, y la Deuda muestra el saldo." />
              <Caso situacion="Pagó la THU, el gas, el ABL o el agua"
                    donde="Extras"
                    efecto="Entra plata, igual que el alquiler." />
              <Caso situacion="Pagó las expensas"
                    donde="Extras"
                    efecto="Entra plata. NO va en la columna Expensas (ver abajo)." />
              <Caso situacion="Dejó el depósito en garantía"
                    donde="Extras"
                    efecto="Entra plata y se le transfiere al dueño. La administración se le cobra salvo que a ese propietario se le haya cedido." />
              <Caso situacion="Pagó un recargo por atraso"
                    donde="Extras"
                    efecto="Entra plata." />
              <Caso situacion="Hay que descontarle algo al propietario"
                    donde="Otros"
                    efecto="Sale de lo que se le transfiere al dueño ese mes." />
              <Caso situacion="Se pagó una reparación, un seguro, un gasto"
                    donde="Otros o Movs."
                    efecto="Sale del neto del propietario. En Movs. además le ponés fecha y detalle." />
              <Caso situacion="Un arreglo, un ajuste o un honorario"
                    donde="Observación"
                    efecto="Los arreglos y ajustes mueven la transferencia cuando los marcás cobrados. Los honorarios son ingreso de la inmobiliaria y no tocan la cuenta del dueño." />
              <Caso situacion="Este contrato cobra algo todos los meses"
                    donde="Recordatorios"
                    efecto="No mueve plata. Es un aviso para que no te lo olvides. Se configura en la ficha del contrato." />
              <Caso situacion="Quiero ver todo lo del contrato en el mes"
                    donde="Movs."
                    efecto="No cargás nada nuevo: te muestra entradas y salidas del contrato, con fecha." />
            </tbody>
          </table>
        </div>
      </GuideCard>

      {/* 2 — para qué sirve cada una */}
      <GuideCard title="2. Para qué sirve cada columna" tint="#0F766E">
        <dl className="space-y-3 text-[13px]">
          <div>
            <dt className="text-ink font-semibold">Alquiler</dt>
            <dd className="text-slate-dark leading-relaxed">
              Los cobros de alquiler del mes, y nada más. Mientras no cargues nada te muestra en gris
              lo que <em>tendría</em> que pagar; cuando cargás el cobro con su fecha, pasa a oscuro.
              Si pagó de menos, te avisa cuánto falta.
            </dd>
          </div>
          <div>
            <dt className="text-ink font-semibold">Extras</dt>
            <dd className="text-slate-dark leading-relaxed">
              Todo lo demás que <strong className="text-ink">entra</strong>: THU, gas, ABL, agua,
              expensas cobradas, depósito en garantía, recargos por mora. Se carga igual que el
              alquiler: tipo, monto y fecha de banco.
            </dd>
          </div>
          <div>
            <dt className="text-ink font-semibold">Recordatorios</dt>
            <dd className="text-slate-dark leading-relaxed">
              <strong className="text-ink">No es plata.</strong> Es la lista de lo que este contrato
              cobra todos los meses, con un punto verde si ya lo cargaste este mes o rojo si falta.
              El monto que ves es lo que <em>hay que</em> cobrar, no lo cobrado. El cobro va en Extras.
            </dd>
          </div>
          <div>
            <dt className="text-ink font-semibold">Expensas</dt>
            <dd className="text-slate-dark leading-relaxed">
              Es un <strong className="text-ink">dato del contrato</strong>: cuánto son las expensas
              mensuales. Sirve de referencia. No es un cobro — cuando el inquilino las paga, eso va
              en Extras.
            </dd>
          </div>
          <div>
            <dt className="text-ink font-semibold">Observación</dt>
            <dd className="text-slate-dark leading-relaxed">
              Arreglos, ajustes y honorarios. En rojo lo que corresponde a este mes, en negro lo que
              viene más adelante. Un arreglo o ajuste recién mueve la transferencia del dueño cuando
              lo marcás como cobrado.
            </dd>
          </div>
          <div>
            <dt className="text-ink font-semibold">Otros</dt>
            <dd className="text-slate-dark leading-relaxed">
              Todo lo que se le <strong className="text-ink">descuenta al propietario</strong>: sale
              de lo que se le transfiere. Nunca es plata que entra. La única salida que no aparece
              acá es la comisión, que tiene su propia columna (ADMI).
            </dd>
          </div>
          <div>
            <dt className="text-ink font-semibold">Movs.</dt>
            <dd className="text-slate-dark leading-relaxed">
              El detalle de todo lo que se movió en ese contrato durante el mes, entradas y salidas.
              Podés cargar una salida desde acá con su fecha y su descripción — es la misma plata que
              después ves sumada en Otros.
            </dd>
          </div>
        </dl>
      </GuideCard>

      {/* 3 — los errores que ya pasaron */}
      <GuideCard title="3. Las confusiones más comunes" tint="#DC2626">
        <ul className="space-y-3 text-[13px] text-slate-dark leading-relaxed">
          <li>
            <strong className="text-ink">Ver un monto en Recordatorios y creer que ya se cobró.</strong>{' '}
            No se cobró: eso es el aviso. Mientras no lo cargues en Extras, para el sistema esa plata
            no entró, y no se le calcula la administración.
          </li>
          <li>
            <strong className="text-ink">Cargar el mismo gasto en Otros y en Movs.</strong>{' '}
            No se reemplaza: se suma. Si ponés $50.000 en los dos lados, al propietario le descontás
            $100.000. Cargalo en uno solo.
          </li>
          <li>
            <strong className="text-ink">Escribir el valor del alquiler en la columna Alquiler.</strong>{' '}
            Esa columna es para los <em>cobros</em>. Si escribís ahí, el sistema entiende que entró un
            pago. Para corregir el valor del contrato se usa la ficha del contrato.
          </li>
          <li>
            <strong className="text-ink">Cargar el monto sin la fecha de banco.</strong>{' '}
            Sin fecha, el sistema lo toma como no cobrado y te lo sigue mostrando en Deuda. La fecha
            es la que confirma que la plata entró.
          </li>
          <li>
            <strong className="text-ink">Cargar un pago en el mes equivocado.</strong>{' '}
            Cada pago va en el mes al que corresponde, aunque la plata entre en otro. Si termina de
            pagar Agosto en Septiembre, eso va en Agosto, con la fecha real.
          </li>
        </ul>
      </GuideCard>

      <Callout tone="tip" title="Si no estás seguro">
        Cargalo y mirá la fila: la <strong className="text-ink">Transferencia</strong> es lo que le
        queda al propietario. Si ese número no es el que esperabas, cargaste en el lugar equivocado.
        Siempre se puede borrar la línea y volver a empezar.
      </Callout>
    </div>
  )
}
