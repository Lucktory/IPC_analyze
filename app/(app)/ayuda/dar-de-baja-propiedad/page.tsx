import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { GuideCard, Step, Callout } from '@/components/ayuda/guide-ui'

export const metadata = { title: 'Dar de baja / reactivar propiedad — Ayuda' }

export default function DarDeBajaPropiedadPage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-auto pb-6 max-w-3xl">
      <BreadcrumbTitle name="Dar de baja / reactivar propiedad" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <Link href="/ayuda" className="hover:text-ink transition-colors">Ayuda</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Dar de baja / reactivar propiedad</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">Dar de baja / reactivar propiedad</h1>
        <p className="text-[13.5px] text-slate-dark mt-1">
          Sacar una propiedad de tu cartera (la perdés, el dueño se la lleva, o ya no la administrás) y volver atrás
          si hace falta. Es <strong className="text-ink">reversible</strong>.
        </p>
      </header>

      <Callout tone="info" title="Dónde está">
        En la <strong className="text-ink">ficha de la propiedad</strong>, arriba a la derecha.
      </Callout>

      {/* dar de baja */}
      <GuideCard title="Dar de baja una propiedad" tint="#16A34A">
        <ul className="space-y-2">
          <Step n={1}>Abrí la ficha de la propiedad (desde <strong className="text-ink">Propiedades</strong>).</Step>
          <Step n={2}>Arriba a la derecha, tocá <strong className="text-ink">Dar de baja</strong>.</Step>
          <Step n={3}>Aparece la confirmación: <em>«¿Dar de baja esta propiedad? Dejará de contarse en tu cartera activa. Podés reactivarla después.»</em></Step>
          <Step n={4}>Tocá <strong className="text-ink">Sí, dar de baja</strong> (o <strong className="text-ink">Cancelar</strong>).</Step>
        </ul>
        <Callout tone="warn" title="Si la propiedad tiene contratos activos">
          El sistema te avisa: esos contratos <strong className="text-ink">siguen facturando</strong> en la planilla aunque des de baja la
          propiedad. Dar de baja la propiedad <strong className="text-ink">no</strong> rescinde sus contratos (son cosas distintas). Si de
          verdad la perdiste, conviene también <strong className="text-ink">rescindir el/los contrato(s)</strong> (ver <em>Rescindir / reactivar contrato</em>).
        </Callout>
        <div className="mt-3 pt-3 border-t border-line">
          <p className="text-[13px] text-slate-dark leading-relaxed">Qué pasa cuando la das de baja:</p>
          <ul className="mt-2 space-y-2">
            <Step n={1}>Sale de la <strong className="text-ink">cartera activa</strong>: no aparece en la lista de Propiedades ni cuenta en sus estadísticas.</Step>
            <Step n={2}>Si estaba vacante, deja de marcar <strong className="text-ink">urgencia</strong> (ya no es algo para resolver).</Step>
            <Step n={3}>Queda con el cartelito <strong className="text-ink">Inactiva</strong>.</Step>
          </ul>
        </div>
      </GuideCard>

      {/* reactivar */}
      <GuideCard title="Reactivar una propiedad" tint="#16A34A">
        <ul className="space-y-2">
          <Step n={1}>En la lista de <strong className="text-ink">Propiedades</strong>, tocá el botón <strong className="text-ink">Inactivas</strong> (muestra cuántas hay) para ver las dadas de baja.</Step>
          <Step n={2}>Abrí la propiedad y tocá <strong className="text-ink">Reactivar propiedad</strong> (un solo clic).</Step>
          <Step n={3}>Vuelve a la cartera activa.</Step>
        </ul>
      </GuideCard>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link href="/ayuda/rescindir-contrato" className="text-[13px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">← Rescindir / reactivar contrato</Link>
        <span className="text-[13px] text-slate/60">Siguiente: Diagnóstico y errores (próximamente)</span>
      </div>
    </div>
  )
}
