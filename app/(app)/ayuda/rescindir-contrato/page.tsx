import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { GuideCard, Step, Callout } from '@/components/ayuda/guide-ui'

export const metadata = { title: 'Rescindir / reactivar contrato — Ayuda' }

export default function RescindirContratoPage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-auto pb-6 max-w-3xl">
      <BreadcrumbTitle name="Rescindir / reactivar contrato" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <Link href="/ayuda" className="hover:text-ink transition-colors">Ayuda</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Rescindir / reactivar contrato</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">Rescindir / reactivar contrato</h1>
        <p className="text-[13.5px] text-slate-dark mt-1">
          Terminar un contrato (se cortó, el dueño se lleva la propiedad, o ya no lo administrás) y, si hace falta,
          volver atrás. Es <strong className="text-ink">reversible</strong>.
        </p>
      </header>

      <Callout tone="info" title="Dónde está">
        En la <strong className="text-ink">ficha del contrato</strong>, arriba a la derecha, debajo del estado (el cartelito verde
        «Activo» / rojo «Rescindido»).
      </Callout>

      {/* rescindir */}
      <GuideCard title="Rescindir un contrato" tint="#DC2626">
        <ul className="space-y-2">
          <Step n={1}>Abrí la ficha del contrato (desde <strong className="text-ink">Contratos</strong> o el número de contrato).</Step>
          <Step n={2}>Arriba a la derecha, tocá <strong className="text-ink">Rescindir contrato</strong>.</Step>
          <Step n={3}>El botón <strong className="text-ink">arma una cuenta regresiva</strong> de 5 segundos y se pone rojo: <em>«Cancelar · Rescindir contrato en 5s»</em>.</Step>
          <Step n={4}>Si no hacés nada, al llegar a <strong className="text-ink">0</strong> el contrato se rescinde solo. Para <strong className="text-ink">no hacerlo</strong>, tocá el botón otra vez antes de que termine (lo cancela).</Step>
        </ul>
        <div className="mt-3 pt-3 border-t border-line">
          <p className="text-[13px] text-slate-dark leading-relaxed">Qué pasa cuando lo rescindís:</p>
          <ul className="mt-2 space-y-2">
            <Step n={1}>Sale de la <strong className="text-ink">planilla activa</strong> (Liquidación) al instante.</Step>
            <Step n={2}>Deja de contarse en el <strong className="text-ink">Panel</strong> (contratos activos, etc.).</Step>
            <Step n={3}>Queda marcado como <strong className="text-ink">Rescindido</strong>. La <strong className="text-ink">fecha de fin no se toca</strong> (para que reactivar sea una vuelta atrás limpia).</Step>
          </ul>
        </div>
      </GuideCard>

      {/* reactivar */}
      <GuideCard title="Reactivar un contrato" tint="#16A34A">
        <ul className="space-y-2">
          <Step n={1}>Abrí la ficha del contrato rescindido.</Step>
          <Step n={2}>Arriba a la derecha, tocá <strong className="text-ink">Reactivar contrato</strong> (es un solo clic, sin confirmación).</Step>
          <Step n={3}>Vuelve a <strong className="text-ink">activo</strong> y reaparece en la planilla.</Step>
        </ul>
      </GuideCard>

      {/* notas */}
      <GuideCard title="Para tener en cuenta" tint="#475569">
        <ul className="space-y-2">
          <Step n={1}>Rescindir es a nivel <strong className="text-ink">contrato</strong>. Si además <strong className="text-ink">perdés la propiedad</strong> (no la administrás más), conviene también darla de baja (ver <em>Dar de baja / reactivar propiedad</em>).</Step>
          <Step n={2}>No borra el historial: el contrato sigue figurando en el <strong className="text-ink">historial de la propiedad</strong>.</Step>
        </ul>
      </GuideCard>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link href="/ayuda/comision-transferencia" className="text-[13px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">← Comisión y transferencia</Link>
        <span className="text-[13px] text-slate/60">Siguiente: Dar de baja / reactivar propiedad (próximamente)</span>
      </div>
    </div>
  )
}
