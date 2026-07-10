import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { GuideCard, Step, Callout, ErrorRow } from '@/components/ayuda/guide-ui'

export const metadata = { title: 'Honorarios — Ayuda' }

export default function HonorariosPage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-auto pb-6 max-w-3xl">
      <BreadcrumbTitle name="Honorarios" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <Link href="/ayuda" className="hover:text-ink transition-colors">Ayuda</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Honorarios</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">Honorarios</h1>
        <p className="text-[13.5px] text-slate-dark mt-1">
          El <strong className="text-ink">fee de la inmobiliaria</strong>: se cobra una vez, al hacer un contrato nuevo o al renovar.
          Se pueden cobrar en cuotas.
        </p>
      </header>

      <Callout tone="info" title="Es ingreso de la inmobiliaria">
        Los honorarios son plata de la inmobiliaria: <strong className="text-ink">nunca</strong> entran en la liquidación
        del dueño. Se muestran en la columna <strong className="text-ink">Honorarios</strong> de la planilla (con su total abajo)
        y en el <strong className="text-ink">Panel</strong>.
      </Callout>

      {/* cargar */}
      <GuideCard title="Cargar un honorario" tint="#7C3AED">
        <ul className="space-y-2">
          <Step n={1}>Hacé clic en la celda <strong className="text-ink">Observación</strong> de la fila del contrato.</Step>
          <Step n={2}>En el modal, bajá a la sección <strong className="text-ink">Honorarios</strong> (la de color azul).</Step>
          <Step n={3}>Poné el <strong className="text-ink">Monto (neto)</strong> — el total de los honorarios.</Step>
          <Step n={4}>Elegí las <strong className="text-ink">Cuotas</strong>: 1 (pago único), 2, 3… hasta 12.</Step>
          <Step n={5}>Elegí <strong className="text-ink">Con IVA 21%</strong> o <strong className="text-ink">Sin IVA</strong>. (Opcional: una descripción.)</Step>
          <Step n={6}>Tocá <strong className="text-ink">Agregar</strong>. Debajo te muestra la cuenta: <em>«→ N cuotas de $X (con IVA $Y), desde este mes»</em>.</Step>
        </ul>
        <Callout tone="tip" title="Las cuotas se crean todas juntas">
          Si cargás varias cuotas, se crean todas de una (una por mes). Las ves listadas en la sección
          <strong className="text-ink"> Honorarios</strong> del modal; en la planilla, cada cuota cae en la columna
          <strong className="text-ink"> Honorarios</strong> del mes que le corresponde.
        </Callout>
      </GuideCard>

      {/* saldo */}
      <GuideCard title="Si lo pagan antes: cobrar el saldo" tint="#7C3AED">
        <p className="text-[13px] text-slate-dark leading-relaxed">
          A veces el plan era de 3 o 4 cuotas pero lo terminan de pagar antes. En la sección Honorarios, cuando quedan
          cuotas futuras, aparece el botón <strong className="text-ink">→ Cobrar saldo restante ahora</strong>.
        </p>
        <ul className="mt-2 space-y-1.5">
          <Step n={1}>Tocá <strong className="text-ink">→ Cobrar saldo restante ahora</strong>.</Step>
          <Step n={2}>Junta todas las cuotas que faltan en <strong className="text-ink">este mes</strong> y cierra las futuras. Listo.</Step>
        </ul>
      </GuideCard>

      {/* iva */}
      <GuideCard title="Sobre el IVA" tint="#7C3AED">
        <ul className="space-y-2">
          <Step n={1}>El monto que cargás es el <strong className="text-ink">neto</strong> (el ingreso de la inmobiliaria).</Step>
          <Step n={2}>Si el honorario lleva IVA, el inquilino paga <strong className="text-ink">neto + 21%</strong>; en el listado se marca con <strong className="text-ink">+IVA</strong> y el tooltip muestra el total con IVA.</Step>
          <Step n={3}>La columna <strong className="text-ink">Honorarios</strong> y el total del Panel muestran el <strong className="text-ink">neto</strong> (el IVA es aparte, para AFIP).</Step>
        </ul>
      </GuideCard>

      {/* ver / borrar */}
      <GuideCard title="Ver y borrar" tint="#7C3AED">
        <ul className="space-y-2">
          <Step n={1}>Cada honorario cargado aparece listado en la sección Honorarios del modal.</Step>
          <Step n={2}>Para borrar uno, tocá la <strong className="text-ink">×</strong> a su derecha (te pide confirmar).</Step>
          <Step n={3}>El total del mes se ve en la columna <strong className="text-ink">Honorarios</strong> de la planilla (antes de Transferencia) y sumado abajo. En el <strong className="text-ink">Panel</strong>, en «Ingresos de la inmobiliaria», va junto a la Administración.</Step>
        </ul>
      </GuideCard>

      {/* errores */}
      <GuideCard title="Errores que pueden aparecer" tint="#DC2626">
        <ul className="space-y-2.5">
          <ErrorRow msg="Ingresá el monto de los honorarios.  ·  El monto de los honorarios debe ser mayor a 0.">
            El monto quedó vacío o en 0. Poné el monto neto.
          </ErrorRow>
          <ErrorRow msg="Las cuotas deben ser un número entre 1 y 12.">
            Elegiste una cantidad de cuotas fuera de rango. Poné de 1 a 12.
          </ErrorRow>
          <ErrorRow msg="No hay cuotas futuras para adelantar.">
            Tocaste «Cobrar saldo restante» pero no quedan cuotas futuras (ya está todo cobrado).
          </ErrorRow>
        </ul>
      </GuideCard>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link href="/ayuda/cargar-el-mes" className="text-[13px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">← Cargar el mes</Link>
        <span className="text-[13px] text-slate/60">Siguiente: Comisión y transferencia (próximamente)</span>
      </div>
    </div>
  )
}
