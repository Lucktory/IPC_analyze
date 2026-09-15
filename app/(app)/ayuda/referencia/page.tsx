import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { GuideCard, Callout } from '@/components/ayuda/guide-ui'

export const metadata = { title: 'Referencia y glosario — Ayuda' }

function ColRow({ col, grupo, children }: { col: string; grupo?: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-line/60 align-top">
      <td className="px-2 py-1.5 text-ink font-medium whitespace-nowrap">{col}</td>
      <td className="px-2 py-1.5 text-slate-dark leading-relaxed">{children}</td>
    </tr>
  )
}

function Term({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line/60 py-2">
      <dt className="text-[13.5px] font-semibold text-ink">{t}</dt>
      <dd className="text-[13px] text-slate-dark leading-relaxed mt-0.5">{children}</dd>
    </div>
  )
}

export default function ReferenciaPage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-auto pb-6 max-w-3xl">
      <BreadcrumbTitle name="Referencia y glosario" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <Link href="/ayuda" className="hover:text-ink transition-colors">Ayuda</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Referencia y glosario</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">Referencia y glosario</h1>
        <p className="text-[13.5px] text-slate-dark mt-1">
          Las columnas de la planilla, los términos que se usan, y algunas preguntas frecuentes.
        </p>
      </header>

      {/* columnas */}
      <GuideCard title="Columnas de la planilla" tint="#0891B2">
        {/* Esta tabla contesta "que es esta columna". La pregunta de todos los
            dias es la otra: "donde cargo esto". Por eso el puntero. */}
        <p className="text-[12.5px] text-slate-dark leading-relaxed mb-3">
          Qué es cada columna. Si lo que necesitás es saber <strong className="text-ink">dónde cargar
          algo</strong>, andá a la guía{' '}
          <Link href="/ayuda/donde-cargo" className="text-info hover:underline">¿Dónde cargo cada cosa?</Link>.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse min-w-[520px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="label-cap font-medium text-slate px-2 py-2 whitespace-nowrap">Columna</th>
                <th className="label-cap font-medium text-slate px-2 py-2">Qué es</th>
              </tr>
            </thead>
            <tbody>
              <ColRow col="Check">El semáforo de validación (verde ✓ / amarillo / rojo). Ver la guía Diagnóstico.</ColRow>
              <ColRow col="Observación">Arreglos, ajustes y honorarios del mes (rojo = este mes, negro = más adelante).</ColRow>
              <ColRow col="LFA">Administrador a cargo (L / F / A / FL / D).</ColRow>
              <ColRow col="F. banco">Fecha en que entró el cobro al banco.</ColRow>
              <ColRow col="Propietario">El/los dueño(s) de la propiedad.</ColRow>
              <ColRow col="Expensas">Cuánto son las expensas mensuales del contrato. Es un dato de referencia, no un cobro: cuando el inquilino las paga, va en Extras.</ColRow>
              <ColRow col="Inquilino">El/los inquilino(s).</ColRow>
              <ColRow col="Pct">El % de comisión de administración.</ColRow>
              <ColRow col="Cadencia">Cada cuánto aumenta el alquiler (mensual, trimestral, etc.).</ColRow>
              <ColRow col="Contrato">Número y vigencia (inicio / fin) del contrato.</ColRow>
              <ColRow col="Deuda">Lo que debe el inquilino: este mes + hasta 12 meses de atrás. Un (+) al lado del monto avisa que además debe meses anteriores.</ColRow>
              <ColRow col="Pago">Día de pago del mes.</ColRow>
              <ColRow col="Alquiler">El alquiler del período. Sube solo por IPC: muestra el valor nuevo (en gris) hasta que cargás lo cobrado.</ColRow>
              <ColRow col="Recordatorios">Aviso de los cargos que se repiten cada mes (THU, gas…) + punto verde/rojo. No es plata cobrada. Si el cargo tiene cuotas, avisa en cuál va: «cuota 2 de 3».</ColRow>
              <ColRow col="Extras">Todo lo que entra y no es alquiler: THU, gas, ABL, agua, expensas cobradas, depósito en garantía, recargos por mora.</ColRow>
              <ColRow col="Honorarios">El fee de la inmobiliaria (ingreso propio, no va al dueño).</ColRow>
              <ColRow col="Transferencia">El neto que va al propietario.</ColRow>
              <ColRow col="Otros">Todo lo que se le descuenta al propietario. Nunca es plata que entra. Incluye lo que cargues desde Movs.</ColRow>
              <ColRow col="Movs.">Todos los movimientos del contrato en el mes, entradas y salidas, con fecha y detalle. Desde acá también podés cargar una salida.</ColRow>
              <ColRow col="D. transf">Fecha en que se transfirió al dueño.</ColRow>
              <ColRow col="ADMI">Comisión total de administración (suma de los bancos).</ColRow>
              <ColRow col="IVA">La parte de IVA de la comisión (cuando corresponde).</ColRow>
              <ColRow col="Galicia / BBVA 50/9 / BBVA 51/6">La comisión repartida por banco de destino.</ColRow>
              <ColRow col="Estado">Estado de la liquidación (Borrador / Enviada / Pagada).</ColRow>
              <ColRow col="Mail">Botón para liquidar y enviar el mail al dueño.</ColRow>
            </tbody>
          </table>
        </div>
      </GuideCard>

      {/* glosario */}
      <GuideCard title="Glosario" tint="#7C3AED">
        <dl className="-my-2">
          <Term t="Administración (ADMI)">La comisión mensual que cobra la inmobiliaria por administrar el contrato (un % de lo cobrado).</Term>
          <Term t="Honorarios">El fee que cobra la inmobiliaria por hacer o renovar un contrato. Se cobra una vez (o en cuotas). Es ingreso de la inmobiliaria, no del dueño.</Term>
          <Term t="N/F (facturado / no facturado)">Alquiler en dos partes: una parte facturada (con IVA si corresponde) y otra no facturada.</Term>
          <Term t="Cadencia">Cada cuánto se actualiza el alquiler: mensual, bimestral, trimestral, cuatrimestral, semestral o anual.</Term>
          <Term t="Recupero">Un gasto que el inquilino reintegra (THU, gas, agua, luz, etc.).</Term>
          <Term t="THU">Tasa de Higiene Urbana. Es como se le dice acá; en Buenos Aires le dicen ABL.</Term>
          <Term t="Depósito en garantía">Lo que deja el inquilino al empezar. Se cobra en Extras, se le transfiere al propietario, y se le descuenta la administración salvo que a ese dueño se le haya cedido.</Term>
          <Term t="Deuda anterior">La deuda de antes de Septiembre 2026, que se carga a mano en la ficha del contrato. El sistema no la calcula solo porque esos meses no están completos.</Term>
          <Term t="Conciliado">Un movimiento con fecha de banco, o sea confirmado. Sin fecha está «pendiente» y el sistema lo toma como que la plata todavía no se movió.</Term>
          <Term t="Recargo / mora">Interés por pago atrasado.</Term>
          <Term t="Liquidación">La cuenta del mes que se le rinde al dueño: cobros − comisión − otros + ajustes = neto a transferir.</Term>
          <Term t="Transferencia (neto al propietario)">Lo que finalmente le queda y se le transfiere al dueño.</Term>
          <Term t="LFA">Código del administrador a cargo del contrato (L / F / A / FL / D).</Term>
          <Term t="Rojo / negro (en Observación)">Rojo = corresponde este mes. Negro = para un mes más adelante.</Term>
          <Term t="Cobrado / a cobrar">«A cobrar» está a la vista pero no suma; «cobrado» es lo que entra al recibo del dueño.</Term>
        </dl>
      </GuideCard>

      {/* FAQ */}
      <GuideCard title="Preguntas frecuentes" tint="#475569">
        <dl className="-my-2">
          <Term t="Un mes se ve vacío, ¿está mal?">No. Cada mes se carga por separado; si todavía no lo cargaste, se ve vacío. No es un error.</Term>
          <Term t="Los honorarios, ¿le descuentan algo al dueño?">No. Los honorarios son ingreso de la inmobiliaria y nunca entran en la liquidación del dueño.</Term>
          <Term t="¿Cómo cambio el alquiler del contrato?">
            El alquiler sube solo por IPC según la cadencia — no hace falta tocarlo. Si necesitás dejarlo en un
            valor puntual (por ejemplo para igualarlo a la planilla de la oficina), andá a la ficha del contrato,{' '}
            <strong className="text-ink">Aumentos → Manual</strong> y poné el monto. Ese camino además le avisa al
            sistema que desde ese mes ese valor es el bueno, así no te lo vuelve a recalcular.
          </Term>
          <Term t="Escribí en la columna Alquiler y me lo tomó como un pago, ¿por qué?">
            Porque esa columna es para los <strong className="text-ink">cobros</strong>, no para el valor del contrato.
            Cuando todavía no cargaste nada te muestra en gris lo que tendría que pagar, y por eso parece el campo del
            alquiler. Para cambiar el valor, ficha del contrato.
          </Term>
          <Term t="¿Por qué me figura deuda en un contrato que está al día?">
            Casi siempre es la fecha. Un cobro cuenta cuando tiene <strong className="text-ink">fecha de banco</strong>:
            si cargaste el monto y te faltó la fecha, el sistema lo toma como no cobrado y te lo muestra en Deuda.
          </Term>
          <Term t="¿Por qué no me aparece deuda de meses viejos?">
            Porque la deuda automática arranca en <strong className="text-ink">Septiembre 2026</strong>. Los meses
            anteriores no se cargaron completos, así que contarlos inventaría deuda. Si alguien debe de antes, se
            carga a mano con <strong className="text-ink">Deuda anterior</strong> en la ficha del contrato.
          </Term>
          <Term t="Rescindí / di de baja algo por error, ¿lo puedo recuperar?">Sí. Todo es reversible: Reactivar contrato o Reactivar propiedad.</Term>
        </dl>
      </GuideCard>

      <Callout tone="tip" title="¿Falta algo?">
        Si hay algo que no está en esta guía, contáselo a Alejandro y lo sumamos.
      </Callout>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link href="/ayuda/diagnostico" className="text-[13px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">← Diagnóstico y errores</Link>
        <Link href="/ayuda" className="text-[13px] text-info hover:underline">Volver al índice</Link>
      </div>
    </div>
  )
}
