import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { GuideCard, Step, Callout, ErrorRow } from '@/components/ayuda/guide-ui'

export const metadata = { title: 'Cargar el mes — Ayuda' }

export default function CargarElMesPage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-auto pb-6 max-w-3xl">
      <BreadcrumbTitle name="Cargar el mes" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <Link href="/ayuda" className="hover:text-ink transition-colors">Ayuda</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Cargar el mes</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">Cargar el mes</h1>
        <p className="text-[13.5px] text-slate-dark mt-1">
          Cargar lo que se cobró en el período: el alquiler, los recuperos (ABL, gas, etc.) y las
          observaciones (arreglos / ajustes). Todo desde la planilla (Liquidación).
        </p>
      </header>

      <Callout tone="tip" title="Primero: elegí el mes">
        Arriba de la planilla elegís el <strong className="text-ink">período</strong>. Cada mes se carga por separado.
        Trabajá siempre sobre el mes correcto.
      </Callout>

      {/* 1 — cobros */}
      <GuideCard title="1. Cargar los cobros (Alquiler y Extras)" tint="#0891B2">
        <ul className="space-y-2">
          <Step n={1}>Hacé clic en la celda <strong className="text-ink">Alquiler</strong> (o <strong className="text-ink">Extras</strong>) de la fila. Se abre un cuadro con las líneas del período.</Step>
          <Step n={2}>Cada línea tiene: <strong className="text-ink">Tipo</strong> · <strong className="text-ink">Monto</strong> · <strong className="text-ink">Fecha de banco</strong> · <strong className="text-ink">×</strong> (para borrarla).</Step>
          <Step n={3}>Tocá <strong className="text-ink">+ Agregar concepto</strong> para sumar una línea, elegí el tipo y poné el monto.</Step>
          <Step n={4}>Cargá la <strong className="text-ink">Fecha de banco</strong> en la línea cuando entró la plata. Al ponerla, la celda pasa de gris a oscuro (cobrado) y se completa la columna <strong className="text-ink">F. banco</strong>.</Step>
          <Step n={5}>Guardá con <strong className="text-ink">Guardar</strong> (o clic afuera = guardar; <strong className="text-ink">Esc</strong> = cancelar).</Step>
        </ul>

        <div className="mt-3">
          <p className="text-[13px] text-slate-dark mb-1.5">
            <strong className="text-ink">Alquiler</strong> es solo el alquiler; <strong className="text-ink">Extras</strong> son los
            recuperos y otros ingresos. Tipos que podés elegir:
          </p>
          <p className="text-[12.5px] text-slate-dark leading-relaxed">
            Alquiler · Alquiler s/factura (N/F) · Expensas · Mora / recargo · Recupero ABL · Recupero AySA ·
            Recupero Metrogas / Gas · Recupero Edesur / Luz · Recupero otro servicio · Reintegro servicios · Otro ingreso.
          </p>
        </div>

        <Callout tone="warn" title="El total de Extras incluye el ajuste">
          Si cargaste un ajuste en <strong className="text-ink">Observación</strong>, aparece como una línea de solo lectura dentro
          de Extras (para que el total cuadre). El ajuste se edita en Observación, no acá.
        </Callout>
      </GuideCard>

      {/* 2 — recordatorios */}
      <GuideCard title="2. Recordatorios (los que se repiten cada mes)" tint="#0891B2">
        <p className="text-[13px] text-slate-dark leading-relaxed">
          La columna <strong className="text-ink">Recordatorios</strong> te avisa qué cargos hay que cobrar todos los meses
          (THU, gas, tasa, etc.) y un <strong className="text-ink">punto verde / rojo</strong> según si ya se registró el cobro
          del período. Es un aviso: el monto que ves es lo que <strong className="text-ink">hay que cobrar</strong>, no lo
          que se cobró. El cobro se carga en <strong className="text-ink">Extras</strong>.
        </p>
        <Callout tone="tip" title="Se configuran en la ficha">
          Acá en la planilla la columna Recordatorios es de <strong className="text-ink">solo lectura</strong>. Para agregar, cambiar o sacar
          un recargo recurrente, andá a la ficha del contrato (ver la guía <em>Editar un contrato</em>).
        </Callout>
      </GuideCard>

      {/* 3 — observaciones */}
      <GuideCard title="3. Observaciones (arreglos y ajustes)" tint="#DC2626">
        <ul className="space-y-2">
          <Step n={1}>Hacé clic en la celda <strong className="text-ink">Observación</strong> de la fila. Se abre el modal del mes.</Step>
          <Step n={2}><strong className="text-ink">Este mes</strong> (rojo) = corresponde este mes. <strong className="text-ink">Pendientes</strong> (negro) = para un mes más adelante (se cargan solos cuando llega).</Step>
          <Step n={3}>En <strong className="text-ink">+ Agregar</strong>: descripción, <strong className="text-ink">Al dueño / Al inquilino</strong>, monto, y <strong className="text-ink">Este mes / Mes que viene</strong>. Tocá <strong className="text-ink">Agregar</strong>.</Step>
          <Step n={4}>Marcá <strong className="text-ink">Cobrado</strong> cuando realmente se cobró: recién ahí entra al recibo del dueño. <strong className="text-ink">A cobrar</strong> queda a la vista pero no suma.</Step>
        </ul>
        <Callout tone="tip" title="Honorarios van en el mismo modal">
          Dentro de este modal hay una sección aparte para los <strong className="text-ink">Honorarios</strong> (el fee de la inmobiliaria).
          Está explicada en la guía <em>Honorarios</em>.
        </Callout>
      </GuideCard>

      {/* errores */}
      <GuideCard title="Errores que pueden aparecer" tint="#DC2626">
        <ul className="space-y-2.5">
          <ErrorRow msg="Hay líneas con monto vacío o inválido.">
            En los cobros (Alquiler / Extras), alguna línea quedó sin monto o en 0. Cada línea necesita un monto mayor a 0 (o borrala con la ×).
          </ErrorRow>
          <ErrorRow msg="Cargá una descripción o un monto.">
            En Observación intentaste agregar un ítem vacío. Poné al menos una descripción o un monto.
          </ErrorRow>
        </ul>
      </GuideCard>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link href="/ayuda/editar-contrato" className="text-[13px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">← Editar un contrato</Link>
        <span className="text-[13px] text-slate/60">Siguiente: Honorarios (próximamente)</span>
      </div>
    </div>
  )
}
