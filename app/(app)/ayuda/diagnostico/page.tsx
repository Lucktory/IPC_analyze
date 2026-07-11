import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { GuideCard, Step, Callout } from '@/components/ayuda/guide-ui'

export const metadata = { title: 'Diagnóstico y errores — Ayuda' }

// Row of the "qué dice / qué hacer" tables.
function IssueRow({ dice, children }: { dice: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-line/60 align-top">
      <td className="px-2 py-2 text-ink font-medium min-w-[190px]">{dice}</td>
      <td className="px-2 py-2 text-slate-dark leading-relaxed">{children}</td>
    </tr>
  )
}

function IssueTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] border-collapse min-w-[520px]">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="label-cap font-medium text-slate px-2 py-2">Qué dice</th>
            <th className="label-cap font-medium text-slate px-2 py-2">Qué mirar y cómo arreglar</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export default function DiagnosticoPage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-auto pb-6 max-w-3xl">
      <BreadcrumbTitle name="Diagnóstico y errores" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <Link href="/ayuda" className="hover:text-ink transition-colors">Ayuda</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Diagnóstico y errores</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">Diagnóstico y errores</h1>
        <p className="text-[13.5px] text-slate-dark mt-1">
          El sistema revisa los datos solo y te avisa cuando algo no cierra. Acá: qué mirar y cómo arreglarlo.
        </p>
      </header>

      {/* check column */}
      <GuideCard title="1. La columna Check (el semáforo)" tint="#475569">
        <ul className="space-y-2">
          <Step n={1}>Es la <strong className="text-ink">primera columna</strong> de la planilla (pegada a la izquierda).</Step>
          <Step n={2}><strong className="text-ink">Verde ✓</strong> = todo bien. <strong className="text-ink">Amarillo</strong> = advertencias. <strong className="text-ink">Rojo</strong> = errores. El número dice cuántos.</Step>
          <Step n={3}>Hacé clic y se abre el <strong className="text-ink">detalle</strong> de cada aviso: qué esperaba, qué encontró y la diferencia.</Step>
        </ul>
        <Callout tone="tip" title="Dónde más lo ves">
          La misma información aparece en la <strong className="text-ink">ficha del contrato</strong> (sección Diagnóstico) y en la página{' '}
          <strong className="text-ink">Diagnóstico</strong> del menú, que junta todos los contratos para revisarlos de a tandas.
        </Callout>
      </GuideCard>

      {/* errores */}
      <GuideCard title="2. Errores (rojo) — conviene arreglarlos" tint="#DC2626">
        <IssueTable>
          <IssueRow dice="La transferencia no coincide con el recibo">El monto que transferiste no da igual al neto calculado. Corregí el monto de <strong className="text-ink">Transferencia</strong>, o revisá comisión / ajustes.</IssueRow>
          <IssueRow dice="Transferencia esperada negativa">Un ajuste o descuento dejó el neto en negativo. Revisá <strong className="text-ink">Observación</strong> y <strong className="text-ink">Otros</strong>.</IssueRow>
          <IssueRow dice='Estado "pagada" pero faltan datos'>Marcaste Pagada sin la transferencia o la fecha. Completá los datos o volvé el estado atrás.</IssueRow>
          <IssueRow dice="Alquiler cobrado muy superior al vigente">Puede ser un cero de más al tipear. Verificá el monto del alquiler cobrado.</IssueRow>
          <IssueRow dice="Contrato vencido pero sigue activo">Pasó la fecha de fin. Renovalo (aumento + nueva vigencia) o cerralo.</IssueRow>
          <IssueRow dice="Contrato sin propietarios / sin inquilinos">Falta cargar la persona. Agregala desde la ficha del contrato.</IssueRow>
          <IssueRow dice="Vigencia inválida">La fecha de fin no es posterior al inicio. Corregí las fechas.</IssueRow>
          <IssueRow dice="Depósito devuelto en contrato activo">El depósito figura devuelto pero el contrato sigue activo. Revisá el estado del depósito o cerrá el contrato.</IssueRow>
        </IssueTable>
      </GuideCard>

      {/* advertencias */}
      <GuideCard title="3. Advertencias (amarillo) — para revisar" tint="#CA8A04">
        <IssueTable>
          <IssueRow dice="Hay ingresos pero no hay comisión (ADMI = 0)">Cargaste el cobro pero falta registrar la comisión. Calculala («Calcular comisión» en la ficha de liquidación) o cargala en el banco (Galicia / BBVA). Si no, al dueño se le transfiere de más.</IssueRow>
          <IssueRow dice="Alquiler vencido hace N días">Cobralo, o si corresponde, cargá el recargo por mora.</IssueRow>
          <IssueRow dice="Suma de % de propietarios / inquilinos ≠ 100%">Ajustá los porcentajes desde la ficha hasta que sumen 100.</IssueRow>
          <IssueRow dice="Contrato sin % de comisión">Cargá el % en la columna <strong className="text-ink">Pct</strong> (o en la ficha).</IssueRow>
          <IssueRow dice="Aumento programado vencido">Aplicá el aumento y actualizá la fecha del próximo ajuste.</IssueRow>
          <IssueRow dice="ADMI sin marcador de banco">Una comisión quedó sin asignar a Galicia / BBVA. Verificá las columnas de banco.</IssueRow>
          <IssueRow dice="Fecha de transferencia anterior al cobro">El orden de fechas no cierra. Verificá F. banco y D. transf.</IssueRow>
          <IssueRow dice="IVA marcado pero el administrador no es RI">Revisá el IVA de la comisión: desactivá el flag o asigná un administrador RI.</IssueRow>
          <IssueRow dice="Recargo recurrente sin registrar">Un recargo (ABL, gas…) no tiene el cobro cargado este mes (es el punto rojo en Recargos).</IssueRow>
        </IssueTable>
        <p className="text-[12px] text-slate mt-2.5">
          Cada aviso trae el texto exacto con los números; deciles qué mirar. Empezá por los rojos, después los amarillos.
        </p>
      </GuideCard>

      {/* deuda */}
      <GuideCard title="4. Deuda" tint="#DC2626">
        <p className="text-[13px] text-slate-dark leading-relaxed">
          La columna <strong className="text-ink">Deuda</strong> muestra lo que el inquilino debe. Hacé clic para ver el desglose:
        </p>
        <ul className="mt-2 space-y-2">
          <Step n={1}><strong className="text-ink">Deuda de este mes</strong> = alquiler esperado − lo cobrado.</Step>
          <Step n={2}><strong className="text-ink">Arrastrado</strong>: mira los <strong className="text-ink">3 meses anteriores</strong> y suma lo que quedó sin cobrar.</Step>
          <Step n={3}><strong className="text-ink">Intereses por mora</strong> (si están activados): una <strong className="text-ink">estimación</strong> proporcional al mes. Es solo informativa; <strong className="text-ink">no se cobra sola</strong> — vos decidís si cargar el recargo.</Step>
        </ul>
        <Callout tone="warn" title="Un supuesto a tener en cuenta">
          Para los meses anteriores, la deuda toma como referencia el <strong className="text-ink">alquiler actual</strong>. El desglose lo aclara.
          Si un mes viejo nunca se cargó, no lo cuenta como deuda (para no inventar deuda).
        </Callout>
      </GuideCard>

      {/* colores */}
      <GuideCard title="5. Colores y avisos (para escanear rápido)" tint="#475569">
        <p className="text-[13px] text-slate-dark leading-relaxed mb-2">Las filas y celdas cambian de color para avisarte de un vistazo:</p>
        <ul className="space-y-2">
          <Step n={1}><strong className="text-ink">Vence pronto</strong> (≤30 días) o ya vencido → rojo / crítico.</Step>
          <Step n={2}><strong className="text-ink">Sin pago</strong> del mes, o sin nota → advertencia.</Step>
          <Step n={3}><strong className="text-ink">Próximo aumento</strong> (≤30 días) → aviso.</Step>
          <Step n={4}><strong className="text-ink">Editado hace poco</strong> (últimas 48 hs) → resaltado, para encontrar lo que tocaste.</Step>
        </ul>
      </GuideCard>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link href="/ayuda/dar-de-baja-propiedad" className="text-[13px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">← Dar de baja / reactivar propiedad</Link>
        <span className="text-[13px] text-slate/60">Siguiente: Referencia y glosario (próximamente)</span>
      </div>
    </div>
  )
}
