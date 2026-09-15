import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { GuideCard, Callout } from '@/components/ayuda/guide-ui'

export const metadata = { title: 'Cómo se calcula la liquidación — Ayuda' }

// Capitulo nuevo (2026-09-16). Alejandro se confundio DOS veces la misma semana
// con lo mismo, y no habia ninguna pagina que lo explicara:
//
//   "Le puse fecha de transferencia y el monto A Transferir no disminuyo"
//   "Si tomo los 20.774.346 y le descuento 1.607.224 no me coincide"
//
// Las dos son la formula del embudo. La primera es no saber que "A transferir"
// es lo ADEUDADO y no un saldo pendiente; la segunda es que le faltaba el
// termino de Otros. Los numeros del ejemplo son reales, verificados contra la
// base el 2026-09-15.

/** Una linea de la formula. */
function Termino({ signo, nombre, children }: { signo: string; nombre: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-line/60 align-top">
      <td className="px-2 py-2 text-ink font-semibold tabular-nums w-6">{signo}</td>
      <td className="px-2 py-2 text-ink font-medium whitespace-nowrap">{nombre}</td>
      <td className="px-2 py-2 text-slate-dark leading-relaxed">{children}</td>
    </tr>
  )
}

export default function ComoSeCalculaPage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-auto pb-6 max-w-3xl">
      <BreadcrumbTitle name="Cómo se calcula la liquidación" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <Link href="/ayuda" className="hover:text-ink transition-colors">Ayuda</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Cómo se calcula la liquidación</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">Cómo se calcula la liquidación</h1>
        <p className="text-[13.5px] text-slate-dark mt-1">
          De dónde sale el número que se le transfiere al propietario. Si alguna vez una cuenta no te
          cerró, la respuesta está acá.
        </p>
      </header>

      <Callout tone="tip" title="La fórmula, completa">
        <span className="text-[14px] text-ink font-medium">
          cobrado − comisión − otros + ajustes = <strong>a transferir</strong>
        </span>
        <br />
        Los cuatro términos. Si te salteás uno, no cierra.
      </Callout>

      {/* 1 — los términos */}
      <GuideCard title="1. Qué es cada término" tint="#0891B2">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse min-w-[560px]">
            <tbody>
              <Termino signo="" nombre="Cobrado">
                Todo lo que entró en el mes: alquiler, recuperos (THU, gas, agua), expensas cobradas,
                depósito en garantía, recargos por mora. Es la columna <strong className="text-ink">Alquiler</strong> más
                la columna <strong className="text-ink">Extras</strong>.
              </Termino>
              <Termino signo="−" nombre="Comisión">
                Tu administración. La columna <strong className="text-ink">ADMI</strong>.
              </Termino>
              <Termino signo="−" nombre="Otros">
                Lo que se le descuenta al propietario: gastos, reparaciones, seguros, lo que hayas
                pagado por él. La columna <strong className="text-ink">Otros</strong>.
                <br />
                <strong className="text-ink">Este es el que más se olvida.</strong>
              </Termino>
              <Termino signo="+" nombre="Ajustes">
                Arreglos y ajustes de la columna <strong className="text-ink">Observación</strong>, pero sólo los
                que están marcados como <strong className="text-ink">cobrados</strong>. Los que están «a cobrar»
                se ven pero no suman.
              </Termino>
              <Termino signo="=" nombre="A transferir">
                El neto del propietario. La columna <strong className="text-ink">Transferencia</strong>.
              </Termino>
            </tbody>
          </table>
        </div>
      </GuideCard>

      {/* 2 — ejemplo real */}
      <GuideCard title="2. Un ejemplo de verdad" tint="#16A34A">
        <p className="text-[13px] text-slate-dark leading-relaxed">
          Un contrato, Septiembre 2026, comisión del 6%:
        </p>
        <pre className="mt-2 text-[12.5px] text-ink bg-cream-2 border border-line rounded p-3 overflow-x-auto leading-relaxed">
{`   548.840,00   cobrado (alquiler)
 −  32.930,40   comisión  (6% de 548.840)
 ────────────
   515.909,60   a transferir`}
        </pre>
        <p className="text-[13px] text-slate-dark leading-relaxed mt-2">
          Y eso fue exactamente lo que se le transfirió. Cierra al centavo porque ese mes no hubo
          ni otros descuentos ni ajustes.
        </p>

        <p className="text-[13px] text-slate-dark leading-relaxed mt-3">
          Ahora el mes entero, los 99 contratos juntos:
        </p>
        <pre className="mt-2 text-[12.5px] text-ink bg-cream-2 border border-line rounded p-3 overflow-x-auto leading-relaxed">
{`  20.774.345,91   cobrado
 −  1.607.223,82   comisión
 −    106.275,00   otros      ← el que se olvida
 ──────────────
  19.060.847,09   a transferir`}
        </pre>
        <Callout tone="warn" title="Sin el término de Otros no cierra">
          Si hacés sólo <em>cobrado − comisión</em> te da 19.167.122, y no coincide con lo que muestra
          la pantalla. La diferencia son esos 106.275 de descuentos a propietarios.
        </Callout>
      </GuideCard>

      {/* 3 — el malentendido grande */}
      <GuideCard title="3. «A transferir» no baja cuando pagás" tint="#DC2626">
        <p className="text-[13px] text-slate-dark leading-relaxed">
          Esto confunde a todo el mundo la primera vez, así que vale la pena tenerlo claro.
        </p>
        <p className="text-[13px] text-slate-dark leading-relaxed mt-2">
          <strong className="text-ink">A transferir</strong> es lo que les <strong className="text-ink">corresponde</strong> a
          los propietarios ese mes. No es un saldo pendiente que se va descontando a medida que vas
          pagando.
        </p>
        <p className="text-[13px] text-slate-dark leading-relaxed mt-2">
          Cargás la transferencia y la fecha, y ese número sigue igual. Está bien que siga igual.
        </p>
        <Callout tone="tip" title="Por qué se deja así">
          El sistema guarda dos cosas por separado: lo que <strong className="text-ink">hay que</strong> transferir,
          y lo que <strong className="text-ink">transferiste</strong> de verdad. Después las compara.
          <br />
          Si le transferís de menos a alguien, te lo marca. Si el número bajara solo al cargar el pago,
          no habría contra qué compararlo y el error pasaría desapercibido.
        </Callout>
        <p className="text-[13px] text-slate-dark leading-relaxed mt-2">
          <strong className="text-ink">¿Querés ver qué te falta pagar?</strong> Mirá la columna{' '}
          <strong className="text-ink">D. transf</strong>: las filas sin fecha son las que todavía no saliste
          a transferir.
        </p>
      </GuideCard>

      {/* 4 — descuadre */}
      <GuideCard title="4. El cartel «Descuadre»" tint="#475569">
        <p className="text-[13px] text-slate-dark leading-relaxed">
          Arriba de la planilla, el cuarto cartel. Es el control de que las cuentas cierran.
        </p>
        <ul className="mt-2 space-y-1.5 text-[13px] text-slate-dark leading-relaxed">
          <li><strong className="text-success">$0 · «las cuentas cuadran»</strong> — todo lo transferido coincide con lo calculado.</li>
          <li><strong className="text-danger">Cualquier otro número</strong> — hay contratos donde lo que transferiste no da igual al neto. Buscalos por la columna Check.</li>
        </ul>
        <p className="text-[13px] text-slate-dark leading-relaxed mt-2">
          Es el número que conviene mirar antes de dar el mes por cerrado.
        </p>
      </GuideCard>

      {/* 5 — lo que no entra */}
      <GuideCard title="5. Lo que NO entra en la cuenta del dueño" tint="#7C3AED">
        <ul className="space-y-2 text-[13px] text-slate-dark leading-relaxed">
          <li>
            <strong className="text-ink">Honorarios.</strong> Son ingreso de la inmobiliaria. Tienen su
            propia columna y su propio total, y nunca aparecen en la liquidación del propietario.
          </li>
          <li>
            <strong className="text-ink">El depósito en garantía SÍ entra.</strong> Se cobra al inquilino,
            se le descuenta la administración y el resto va en la transferencia, como cualquier otro cobro.
          </li>
          <li>
            <strong className="text-ink">La transferencia que hiciste.</strong> Se guarda como registro,
            no como parte del cálculo (ver el punto 3).
          </li>
        </ul>
      </GuideCard>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link href="/ayuda/donde-cargo" className="text-[13px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">← ¿Dónde cargo cada cosa?</Link>
        <Link href="/ayuda/honorarios" className="text-[13px] text-info hover:underline transition-colors inline-flex items-center gap-1">Siguiente: Honorarios →</Link>
      </div>
    </div>
  )
}
