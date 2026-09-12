import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { GuideCard, Step, Callout, ErrorRow } from '@/components/ayuda/guide-ui'

export const metadata = { title: 'Editar un contrato — Ayuda' }

// Small 2-column reference row for the planilla cells.
function CellRow({ col, children }: { col: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-line/60 align-top">
      <td className="px-2 py-2 text-ink font-medium whitespace-nowrap">{col}</td>
      <td className="px-2 py-2 text-slate-dark leading-relaxed">{children}</td>
    </tr>
  )
}

export default function EditarContratoPage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-auto pb-6 max-w-3xl">
      <BreadcrumbTitle name="Editar un contrato" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <Link href="/ayuda" className="hover:text-ink transition-colors">Ayuda</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Editar un contrato</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">Editar un contrato</h1>
        <p className="text-[13.5px] text-slate-dark mt-1">
          Un contrato se edita desde <strong className="text-ink">dos lugares</strong>: la <strong className="text-ink">planilla</strong>{' '}
          (clic directo en la celda, para el día a día) y la <strong className="text-ink">ficha del contrato</strong>{' '}
          (cambios de fondo: participantes, aumento, recargos). Casi todo se guarda solo.
        </p>
      </header>

      <Callout tone="tip" title="Cómo abrir la ficha del contrato">
        Entrá a <strong className="text-ink">Contratos</strong> y hacé clic en el número del contrato; o desde la planilla,
        clic en la celda de la columna <strong className="text-ink">Contrato</strong>.
      </Callout>

      {/* A — desde la planilla */}
      <GuideCard title="A. Desde la planilla (clic en la celda)" tint="#0891B2">
        <p className="text-[13.5px] text-slate-dark leading-relaxed mb-3">
          En la planilla (Liquidación), hacés clic directo sobre la celda y editás. Se guarda solo.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse min-w-[480px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="label-cap font-medium text-slate px-2 py-2 whitespace-nowrap">Columna</th>
                <th className="label-cap font-medium text-slate px-2 py-2">Qué editás</th>
              </tr>
            </thead>
            <tbody>
              <CellRow col="LFA">Admin a cargo. Valores: <strong className="text-ink">L / F / A / FL / D</strong>.</CellRow>
              <CellRow col="Expensas">Las expensas mensuales (número ≥ 0).</CellRow>
              <CellRow col="Pct">La comisión de administración (%).</CellRow>
              <CellRow col="IVA">Si la comisión lleva IVA o no (con / sin).</CellRow>
              <CellRow col="Contrato">La vigencia: fecha de <strong className="text-ink">inicio</strong> y de <strong className="text-ink">fin</strong>.</CellRow>
              <CellRow col="Estado">El estado de la liquidación (Borrador → Enviada → Pagada).</CellRow>
              <CellRow col="Transferencia · Otros · Galicia · BBVA">Los montos: clic y editás el número.</CellRow>
              <CellRow col="Alquiler · Extras">Lo cobrado del mes (ver la guía <em>Cargar el mes</em>).</CellRow>
              <CellRow col="Recordatorios">Qué hay que cobrar cada mes. Es un aviso, no plata cobrada.</CellRow>
              <CellRow col="Observación">Arreglos, ajustes y honorarios (ver esas guías).</CellRow>
            </tbody>
          </table>
        </div>
        <Callout tone="tip" title="El alquiler sube solo por IPC">
          El <strong className="text-ink">alquiler del contrato</strong> se actualiza <strong className="text-ink">solo</strong>: cada período que
          toca aumento, la app calcula el nuevo valor por IPC y lo muestra en la celda <strong className="text-ink">Alquiler</strong> (en gris)
          hasta que cargás lo cobrado. No hay que tocar nada para que suba.{' '}
          <strong className="text-ink">Aplicar aumento</strong> en la ficha queda como opción para dejarlo registrado o poner un <strong className="text-ink">%</strong> a mano (ver más abajo).
        </Callout>
      </GuideCard>

      {/* B — desde la ficha */}
      <GuideCard title="B. Desde la ficha del contrato" tint="#0F766E">
        <div className="space-y-4">
          <div>
            <h3 className="text-[13.5px] font-semibold text-ink mb-1.5">Aplicar aumento (opcional)</h3>
            <p className="text-[13px] text-slate-dark leading-relaxed mb-2">
              El alquiler <strong className="text-ink">ya sube solo por IPC</strong> cada período. Este paso es opcional: sirve para dejar
              el aumento <strong className="text-ink">registrado</strong> o para poner un <strong className="text-ink">%</strong> a mano.
            </p>
            <ul className="space-y-1.5">
              <Step n={1}>Arriba a la derecha, tocá <strong className="text-ink">Aplicar aumento</strong>. Te muestra el valor <strong className="text-ink">nuevo</strong> (por IPC) antes de aplicar.</Step>
              <Step n={2}>Dejalo como está (IPC) o escribí un <strong className="text-ink">%</strong> propio.</Step>
              <Step n={3}>Confirmá. En contratos con <strong className="text-ink">N/F</strong>, escala las dos partes (facturado y no facturado) con el mismo factor.</Step>
            </ul>
          </div>

          <div className="pt-3 border-t border-line">
            <h3 className="text-[13.5px] font-semibold text-ink mb-1.5">Propietarios e inquilinos (y sus %)</h3>
            <p className="text-[13px] text-slate-dark leading-relaxed mb-2">
              En las tarjetas <strong className="text-ink">Propietarios</strong> e <strong className="text-ink">Inquilinos</strong> tocás
              para abrir el editor. Funcionan igual (en inquilinos es el % que paga cada uno).
            </p>
            <ul className="space-y-1.5">
              <Step n={1}>Tocá <strong className="text-ink">+ Agregar</strong> para sumar otro; o <strong className="text-ink">+ Crear</strong> para dar de alta uno nuevo ahí mismo.</Step>
              <Step n={2}>Poné el <strong className="text-ink">%</strong> de cada uno. El indicador de suma se pone en verde cuando llega a <strong className="text-ink">100%</strong>.</Step>
              <Step n={3}>Para quitar uno, mantené el botón <strong className="text-ink">×</strong> 10 segundos para confirmar (volvé a tocar para cancelar). Siempre queda al menos uno.</Step>
              <Step n={4}>Tocá <strong className="text-ink">Guardar</strong>. (Cancelar descarta los cambios.)</Step>
            </ul>
            <div className="mt-2.5">
              <Callout tone="tip" title="Reglas de los %">
                Al menos uno, cada % entre 0 y 100, y <strong className="text-ink">deben sumar 100%</strong> — vale tanto para propietarios
                como para inquilinos. Si venían de una importación y no sumaban 100, el editor los reparte en partes iguales y te avisa.
              </Callout>
            </div>
          </div>

          <div className="pt-3 border-t border-line">
            <h3 className="text-[13.5px] font-semibold text-ink mb-1.5">Comisión (%)</h3>
            <p className="text-[13px] text-slate-dark leading-relaxed">
              En la tarjeta <strong className="text-ink">Resumen del contrato</strong>, al lado de <strong className="text-ink">Comisión</strong>,
              editás el porcentaje. (También se puede desde la columna <strong className="text-ink">Pct</strong> de la planilla.)
            </p>
          </div>

          <div className="pt-3 border-t border-line">
            <h3 className="text-[13.5px] font-semibold text-ink mb-1.5">Recordatorios recurrentes (THU, gas, etc.)</h3>
            <p className="text-[13px] text-slate-dark leading-relaxed">
              Cargos que se cobran <strong className="text-ink">todos los meses</strong> aparte del alquiler. En el editor de{' '}
              <strong className="text-ink">Recordatorios</strong> podés <strong className="text-ink">agregar</strong> (etiqueta, monto,
              tipo de recupero, cada cuántos meses, y desde qué período), <strong className="text-ink">editar</strong>,{' '}
              <strong className="text-ink">activar / desactivar</strong> y <strong className="text-ink">borrar</strong>.
            </p>
          </div>

          <div className="pt-3 border-t border-line">
            <h3 className="text-[13.5px] font-semibold text-ink mb-1.5">Notas del período</h3>
            <p className="text-[13px] text-slate-dark leading-relaxed">
              En la tarjeta <strong className="text-ink">Observaciones</strong> de la ficha escribís notas libres por mes.
            </p>
            <Callout tone="warn" title="No confundir">
              Esta <em>Observación de la ficha</em> es una <strong className="text-ink">nota libre</strong>. Es distinta de la
              celda <strong className="text-ink">Observación de la planilla</strong>, que sirve para cargar arreglos, ajustes y honorarios.
            </Callout>
          </div>
        </div>
      </GuideCard>

      {/* C — depósito */}
      <GuideCard title="C. Depósito" tint="#7C3AED">
        <p className="text-[13px] text-slate-dark leading-relaxed">
          El depósito se edita desde la ficha de la <strong className="text-ink">propiedad</strong>: abrí la propiedad,
          desplegá <strong className="text-ink">Editar propiedad</strong> y en <strong className="text-ink">Depósito en garantía</strong> cargás
          el <strong className="text-ink">monto</strong> del depósito del contrato activo y su <strong className="text-ink">estado</strong>:{' '}
          en garantía con el propietario / parcialmente usado / devuelto al inquilino.
        </p>
      </GuideCard>

      {/* D — terminar */}
      <GuideCard title="D. Terminar el contrato" tint="#DC2626">
        <p className="text-[13px] text-slate-dark leading-relaxed">
          Para dar de baja un contrato (o volver atrás), usá <strong className="text-ink">Rescindir / Reactivar</strong> en la
          ficha. Está explicado en la guía <em>Rescindir / reactivar contrato</em>.
        </p>
      </GuideCard>

      {/* errores */}
      <GuideCard title="Errores que pueden aparecer" tint="#DC2626">
        <ul className="space-y-2.5">
          <ErrorRow msg="Los porcentajes deben sumar 100% (suman …%).">
            La suma de los % de los propietarios (o inquilinos) no da 100. Ajustá los porcentajes hasta que sumen 100.
          </ErrorRow>
          <ErrorRow msg="Cada propietario debe tener un porcentaje entre 0 y 100.">
            Un % quedó en 0 o fuera de rango. Corregilo.
          </ErrorRow>
          <ErrorRow msg="No podés repetir el mismo propietario dos veces.">
            Elegiste dos veces al mismo. Sacá el repetido.
          </ErrorRow>
          <ErrorRow msg="La fecha de fin debe ser posterior al inicio.">
            Al editar la vigencia, la fecha de fin quedó igual o antes del inicio. Corregí las fechas.
          </ErrorRow>
          <ErrorRow msg="El monto debe ser mayor a 0.  ·  La frecuencia debe ser entre 1 y 12 meses.">
            Al cargar un recargo recurrente: el monto tiene que ser mayor a 0 y la frecuencia, de 1 a 12 meses.
          </ErrorRow>
          <ErrorRow msg="LFA inválido. Valores aceptados: L / F / A / FL / D.">
            Pusiste una LFA que no existe. Usá una de esas cinco.
          </ErrorRow>
        </ul>
      </GuideCard>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link href="/ayuda/crear-contrato" className="text-[13px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">← Crear un contrato</Link>
        <span className="text-[13px] text-slate/60">Siguiente: Cargar el mes (próximamente)</span>
      </div>
    </div>
  )
}
