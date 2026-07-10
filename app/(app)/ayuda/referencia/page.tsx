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
              <ColRow col="Expensas">Las expensas mensuales del contrato.</ColRow>
              <ColRow col="Inquilino">El/los inquilino(s).</ColRow>
              <ColRow col="Pct">El % de comisión de administración.</ColRow>
              <ColRow col="Cadencia">Cada cuánto aumenta el alquiler (mensual, trimestral, etc.).</ColRow>
              <ColRow col="Contrato">Número y vigencia (inicio / fin) del contrato.</ColRow>
              <ColRow col="Deuda">Lo que debe el inquilino (este mes + arrastrado).</ColRow>
              <ColRow col="Pago">Día de pago del mes.</ColRow>
              <ColRow col="Alquiler">El alquiler cobrado del período.</ColRow>
              <ColRow col="Recargos">Cargos que se repiten cada mes (ABL, gas…) + punto verde/rojo.</ColRow>
              <ColRow col="Extras">Recuperos y otros ingresos que no son alquiler.</ColRow>
              <ColRow col="Honorarios">El fee de la inmobiliaria (ingreso propio, no va al dueño).</ColRow>
              <ColRow col="Transferencia">El neto que va al propietario.</ColRow>
              <ColRow col="Otros">Otros descuentos del período.</ColRow>
              <ColRow col="Movs.">Cantidad y neto de movimientos del contrato en el mes.</ColRow>
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
          <Term t="Recupero">Un gasto que el inquilino reintegra (ABL, AySA, Metrogas, Edesur, etc.).</Term>
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
          <Term t="¿Cómo cambio el alquiler del contrato?">No se edita la celda Alquiler (esa es lo cobrado): usá «Aplicar aumento» en la ficha del contrato.</Term>
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
