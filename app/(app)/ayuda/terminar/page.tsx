import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { GuideCard, Step, Callout } from '@/components/ayuda/guide-ui'

export const metadata = { title: 'Terminar un contrato o una propiedad — Ayuda' }

// Fusion de dos capitulos (2026-09-16): "Rescindir / reactivar contrato" y
// "Dar de baja / reactivar propiedad" eran 73 y 69 lineas con la misma forma —
// terminar algo, reversible, con confirmacion. Dos tarjetas en el indice para
// una sola idea.
//
// Y juntarlos ayuda, porque lo que mas confunde es justamente la diferencia
// entre las dos cosas: dar de baja la propiedad NO rescinde sus contratos, y
// esos contratos siguen facturando. Puestos uno al lado del otro, se ve.

export default function TerminarPage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-auto pb-6 max-w-3xl">
      <BreadcrumbTitle name="Terminar un contrato o una propiedad" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <Link href="/ayuda" className="hover:text-ink transition-colors">Ayuda</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Terminar un contrato o una propiedad</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">Terminar un contrato o una propiedad</h1>
        <p className="text-[13.5px] text-slate-dark mt-1">
          Cerrar un contrato que terminó, o sacar una propiedad de la cartera. Son{' '}
          <strong className="text-ink">dos cosas distintas</strong>, y las dos se pueden deshacer.
        </p>
      </header>

      <Callout tone="warn" title="No es lo mismo una cosa que la otra">
        <strong className="text-ink">Rescindir el contrato</strong> termina el alquiler: deja de aparecer en la
        planilla y de facturar.
        <br />
        <strong className="text-ink">Dar de baja la propiedad</strong> la saca de tu cartera, pero{' '}
        <strong className="text-ink">no toca sus contratos</strong>: si tienen contratos activos, esos siguen
        facturando igual.
        <br />
        Si perdiste la propiedad de verdad, hacé las dos cosas.
      </Callout>

      {/* ── CONTRATO ────────────────────────────────────────────────────── */}
      <GuideCard title="Rescindir un contrato" tint="#DC2626">
        <p className="text-[13px] text-slate-dark leading-relaxed mb-2">
          Está en la <strong className="text-ink">ficha del contrato</strong>, arriba a la derecha, debajo del
          cartelito de estado.
        </p>
        <ul className="space-y-2">
          <Step n={1}>Abrí la ficha del contrato (desde <strong className="text-ink">Contratos</strong> o el número de contrato).</Step>
          <Step n={2}>Tocá <strong className="text-ink">Rescindir contrato</strong>.</Step>
          <Step n={3}>Arranca una <strong className="text-ink">cuenta regresiva de 5 segundos</strong> y el botón se pone rojo: <em>«Cancelar · Rescindir contrato en 5s»</em>.</Step>
          <Step n={4}>Si no hacés nada, al llegar a <strong className="text-ink">0</strong> se rescinde. Para <strong className="text-ink">no hacerlo</strong>, tocá el botón otra vez antes de que termine.</Step>
        </ul>
        <div className="mt-3 pt-3 border-t border-line">
          <p className="text-[13px] text-slate-dark leading-relaxed">Qué pasa cuando lo rescindís:</p>
          <ul className="mt-2 space-y-2">
            <Step n={1}>Sale de la <strong className="text-ink">planilla</strong> al instante.</Step>
            <Step n={2}>Deja de contarse en el <strong className="text-ink">Panel</strong>.</Step>
            <Step n={3}>Queda marcado como <strong className="text-ink">Rescindido</strong>. La <strong className="text-ink">fecha de fin no se toca</strong>, así reactivarlo es una vuelta atrás limpia.</Step>
          </ul>
        </div>
        <Callout tone="tip" title="Para volver atrás">
          Abrí la ficha del contrato rescindido y tocá <strong className="text-ink">Reactivar contrato</strong>. Es
          un solo clic, sin confirmación. Vuelve a la planilla.
        </Callout>
      </GuideCard>

      {/* ── PROPIEDAD ───────────────────────────────────────────────────── */}
      <GuideCard title="Dar de baja una propiedad" tint="#16A34A">
        <p className="text-[13px] text-slate-dark leading-relaxed mb-2">
          Está en la <strong className="text-ink">ficha de la propiedad</strong>, arriba a la derecha.
        </p>
        <ul className="space-y-2">
          <Step n={1}>Abrí la ficha de la propiedad (desde <strong className="text-ink">Propiedades</strong>).</Step>
          <Step n={2}>Tocá <strong className="text-ink">Dar de baja</strong>.</Step>
          <Step n={3}>Aparece la confirmación: <em>«¿Dar de baja esta propiedad? Dejará de contarse en tu cartera activa. Podés reactivarla después.»</em></Step>
          <Step n={4}>Tocá <strong className="text-ink">Sí, dar de baja</strong> (o <strong className="text-ink">Cancelar</strong>).</Step>
        </ul>
        <Callout tone="warn" title="Si la propiedad tiene contratos activos">
          El sistema te avisa: esos contratos <strong className="text-ink">siguen facturando</strong> en la planilla
          aunque des de baja la propiedad. Dar de baja la propiedad <strong className="text-ink">no</strong> rescinde
          sus contratos.
          <br />
          Si de verdad la perdiste, rescindí también el o los contratos (acá arriba).
        </Callout>
        <div className="mt-3 pt-3 border-t border-line">
          <p className="text-[13px] text-slate-dark leading-relaxed">Qué pasa cuando la das de baja:</p>
          <ul className="mt-2 space-y-2">
            <Step n={1}>Sale de la <strong className="text-ink">cartera activa</strong>: no aparece en la lista de Propiedades ni cuenta en sus estadísticas.</Step>
            <Step n={2}>Si estaba vacante, deja de marcar <strong className="text-ink">urgencia</strong>.</Step>
            <Step n={3}>Queda con el cartelito <strong className="text-ink">Inactiva</strong>.</Step>
          </ul>
        </div>
        <Callout tone="tip" title="Para volver atrás">
          En la lista de <strong className="text-ink">Propiedades</strong>, tocá el botón{' '}
          <strong className="text-ink">Inactivas</strong> (te dice cuántas hay), abrí la propiedad y tocá{' '}
          <strong className="text-ink">Reactivar propiedad</strong>. Un solo clic.
        </Callout>
      </GuideCard>

      <Callout tone="tip" title="Nada se borra">
        Ni rescindir ni dar de baja borran información. El contrato sigue figurando en el historial de la
        propiedad, con todo lo que se cargó en su momento.
      </Callout>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link href="/ayuda/honorarios" className="text-[13px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">← Honorarios</Link>
        <span />
      </div>
    </div>
  )
}
