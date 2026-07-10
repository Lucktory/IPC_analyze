import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { GuideCard, Step, Callout, FieldTable, Field, ErrorRow } from '@/components/ayuda/guide-ui'

export const metadata = { title: 'Crear un contrato — Ayuda' }

export default function CrearContratoPage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-auto pb-6 max-w-3xl">
      <BreadcrumbTitle name="Crear un contrato" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <Link href="/ayuda" className="hover:text-ink transition-colors">Ayuda</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Crear un contrato</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">Crear un contrato</h1>
        <p className="text-[13.5px] text-slate-dark mt-1">
          Cómo dar de alta un contrato nuevo. Al crearlo queda <strong className="text-ink">activo</strong> y
          aparece en la planilla (Liquidación) del período.
        </p>
      </header>

      <Callout tone="info" title="Antes que nada">
        El contrato se crea con <strong className="text-ink">un</strong> inquilino y <strong className="text-ink">un</strong> propietario
        (que queda con el <strong className="text-ink">100%</strong>). Los co-propietarios, los co-inquilinos y la
        comisión se agregan / editan <strong className="text-ink">después</strong> (ver la guía{' '}
        <Link href="/ayuda" className="text-info hover:underline">Editar un contrato</Link>).
      </Callout>

      <GuideCard title="Antes de empezar (requisito)" tint="#0F766E">
        <p className="text-[13.5px] text-slate-dark leading-relaxed">
          Para poder crear un contrato tenés que tener cargado, como mínimo:
        </p>
        <ul className="mt-2 space-y-2">
          <Step n={1}>Una <strong className="text-ink">propiedad</strong> — se carga en <Link href="/propiedades/nuevo" className="text-info hover:underline">Propiedades → Nueva propiedad</Link>.</Step>
          <Step n={2}>Un <strong className="text-ink">propietario</strong> — en <Link href="/propietarios/nuevo" className="text-info hover:underline">Propietarios → Nuevo</Link>.</Step>
          <Step n={3}>Un <strong className="text-ink">inquilino</strong> — en <Link href="/inquilinos/nuevo" className="text-info hover:underline">Inquilinos → Nuevo</Link>.</Step>
        </ul>
        <p className="text-[12.5px] text-slate mt-2.5">
          Si falta alguno, la pantalla de alta te avisa y te deja el link para crearlo.
        </p>
      </GuideCard>

      <GuideCard title="Cómo llegar a la pantalla" tint="#0F766E">
        <ul className="space-y-2">
          <Step n={1}>En el menú de la izquierda, entrá a <strong className="text-ink">Contratos</strong>.</Step>
          <Step n={2}>Arriba a la derecha, tocá <strong className="text-ink">+ Nuevo contrato</strong>.</Step>
          <Step n={3}>Se abre la pantalla <strong className="text-ink">Onboarding de contrato</strong> con el formulario <strong className="text-ink">Datos del contrato</strong>.</Step>
        </ul>
      </GuideCard>

      <GuideCard title="Los campos, uno por uno" tint="#0F766E">
        <FieldTable>
          <Field campo="Propiedad" obligatorio>La unidad del contrato. Se elige de la lista de propiedades cargadas.</Field>
          <Field campo="Inquilino principal" obligatorio>Quién alquila. Se elige de la lista de inquilinos.</Field>
          <Field campo="Propietario principal" obligatorio>El dueño. Queda automáticamente con el <strong className="text-ink">100%</strong> (los demás co-dueños se agregan después).</Field>
          <Field campo="Alquiler inicial ($)" obligatorio>El alquiler de arranque. Tiene que ser <strong className="text-ink">mayor a 0</strong>. Ej.: 180000.</Field>
          <Field campo="Expensas mensuales ($)" porDefecto="0">Las expensas, aparte del alquiler.</Field>
          <Field campo="Cadencia de aumentos" porDefecto="Trimestral">Cada cuánto aumenta: Mensual, Bimestral, Trimestral, Cuatrimestral, Semestral o Anual.</Field>
          <Field campo="Índice de actualización" porDefecto="IPC General">Con qué índice se actualiza: IPC General (INDEC), ICL (BCRA), Casa Propia o Fijo (sin actualización).</Field>
          <Field campo="Fecha de inicio" obligatorio porDefecto="hoy">Arranque de la vigencia.</Field>
          <Field campo="Fecha de fin" obligatorio porDefecto="+3 años">Fin estimado (se puede ajustar después). Tiene que ser <strong className="text-ink">posterior</strong> al inicio.</Field>
          <Field campo="Día de pago (1–31)" porDefecto="5">Qué día del mes paga el inquilino.</Field>
          <Field campo="Moneda" porDefecto="ARS">Pesos (ARS) o Dólares (USD).</Field>
          <Field campo="Número de contrato" porDefecto="automático">Si lo dejás vacío, el sistema le asigna uno solo con el formato <strong className="text-ink">C-AÑO-NNNN</strong>.</Field>
          <Field campo="LFA (admin a cargo)">Código del administrador a cargo: <strong className="text-ink">L</strong>, <strong className="text-ink">F</strong> o <strong className="text-ink">A</strong>.</Field>
        </FieldTable>
        <p className="text-[12px] text-slate mt-2.5">
          Los campos con <span className="text-danger">*</span> son obligatorios. El resto se puede dejar en su valor por defecto.
        </p>
      </GuideCard>

      <GuideCard title="Paso a paso" tint="#0F766E">
        <ul className="space-y-2">
          <Step n={1}>Completá los campos obligatorios (<span className="text-danger">*</span>): Propiedad, Inquilino, Propietario y Alquiler inicial.</Step>
          <Step n={2}>Revisá <strong className="text-ink">Fecha de fin</strong> (viene 3 años por defecto) y el <strong className="text-ink">Día de pago</strong>.</Step>
          <Step n={3}>Ajustá <strong className="text-ink">Cadencia</strong> e <strong className="text-ink">Índice</strong> si corresponde.</Step>
          <Step n={4}>Tocá <strong className="text-ink">Crear contrato</strong> (te pide confirmar y lo crea).</Step>
          <Step n={5}>El sistema te lleva directo a la <strong className="text-ink">ficha del contrato</strong> nuevo.</Step>
        </ul>
      </GuideCard>

      <GuideCard title="Qué pasa cuando lo creás" tint="#0F766E">
        <ul className="space-y-2">
          <Step n={1}>El contrato queda <strong className="text-ink">activo</strong> y aparece en la planilla (Liquidación) del período.</Step>
          <Step n={2}>Si no pusiste número, se le asigna <strong className="text-ink">C-AÑO-NNNN</strong> (correlativo dentro del año de inicio).</Step>
          <Step n={3}>El propietario elegido queda con el <strong className="text-ink">100%</strong> y el inquilino como <strong className="text-ink">principal</strong>.</Step>
        </ul>
      </GuideCard>

      <Callout tone="warn" title="Ojo: lo que NO se carga acá (se hace después)">
        <ul className="list-disc pl-4 space-y-1">
          <li><strong className="text-ink">Co-propietarios / co-inquilinos</strong> con sus porcentajes → desde la ficha del contrato.</li>
          <li><strong className="text-ink">N/F</strong> (facturado + no facturado): este alta crea un alquiler simple. El desglose N/F <strong className="text-ink">no se configura desde la app</strong> — hoy lo carga el administrador del sistema. Si un contrato lo necesita, avisá a Alejandro.</li>
          <li><strong className="text-ink">Comisión (%) y su IVA</strong> → se cargan / editan desde la planilla o la ficha.</li>
        </ul>
        <p className="mt-1.5">Todo eso está en la guía <em>Editar un contrato</em>.</p>
      </Callout>

      <GuideCard title="Errores que pueden aparecer" tint="#DC2626">
        <ul className="space-y-2.5">
          <ErrorRow msg="Seleccioná una propiedad / un inquilino / un propietario.">
            Falta elegir uno de los tres. Elegilo del desplegable correspondiente.
          </ErrorRow>
          <ErrorRow msg="Alquiler inicial debe ser mayor a 0.">
            El alquiler quedó vacío o en 0. Cargá el monto del alquiler.
          </ErrorRow>
          <ErrorRow msg="La fecha de fin debe ser posterior al inicio.">
            La fecha de fin es igual o anterior a la de inicio. Corregí las fechas.
          </ErrorRow>
          <ErrorRow msg="Día de pago debe ser entre 1 y 31.">
            El día quedó fuera de rango. Poné un número del 1 al 31.
          </ErrorRow>
          <ErrorRow msg="Antes de crear un contrato necesitás cargar al menos…">
            No hay propiedades, propietarios o inquilinos cargados. Creá primero lo que falte (los links salen en la misma pantalla).
          </ErrorRow>
        </ul>
      </GuideCard>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link href="/ayuda" className="text-[13px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">← Volver a la guía</Link>
        <span className="text-[13px] text-slate/60">Siguiente: Editar un contrato (próximamente)</span>
      </div>
    </div>
  )
}
