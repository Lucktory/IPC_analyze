import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'

// Ayuda — index of the step-by-step guides. Function/task-based: one chapter per
// thing you want to DO. Chapters are added one at a time; the ones not written
// yet show as "Próximamente".
export const metadata = { title: 'Ayuda' }

interface Chapter { n: number; title: string; desc: string; href?: string; tint: string }

const CHAPTERS: Chapter[] = [
  { n: 1, title: 'Crear un contrato',              desc: 'Dar de alta un contrato nuevo, campo por campo.',            href: '/ayuda/crear-contrato', tint: '#0F766E' },
  { n: 2, title: 'Editar un contrato',             desc: 'Planilla y ficha: %, participantes, vigencia, aumento, recargos.', href: '/ayuda/editar-contrato', tint: '#0F766E' },
  { n: 3, title: 'Cargar el mes',                  desc: 'Cobros y Observaciones (arreglos / ajustes).',               href: '/ayuda/cargar-el-mes', tint: '#0891B2' },
  { n: 4, title: 'Honorarios',                     desc: 'Fee de la inmobiliaria: cuotas, IVA y saldo.',               tint: '#7C3AED' },
  { n: 5, title: 'Comisión y transferencia',       desc: 'ADMI, bancos, y enviar la liquidación al dueño.',            tint: '#16A34A' },
  { n: 6, title: 'Rescindir / reactivar contrato', desc: 'Terminar un contrato y volver atrás si hace falta.',          tint: '#DC2626' },
  { n: 7, title: 'Dar de baja / reactivar propiedad', desc: 'Sacar una propiedad de la cartera (reversible).',          tint: '#16A34A' },
  { n: 8, title: 'Diagnóstico y errores',          desc: 'Qué mirar cuando algo no cierra, y cómo resolverlo.',         tint: '#475569' },
  { n: 9, title: 'Referencia y glosario',          desc: 'Columnas de la planilla, términos y preguntas.',             tint: '#64748B' },
]

export default function AyudaPage() {
  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-auto pb-6">
      <BreadcrumbTitle name="Ayuda" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Ayuda</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">Guía de uso</h1>
        <p className="text-[13.5px] text-slate-dark mt-1 max-w-2xl">
          Guías paso a paso, ordenadas por tarea. Cada una explica en detalle cómo se hace, qué significa
          cada campo, y qué hacer cuando algo no cierra. Se van sumando de a una.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {CHAPTERS.map(ch => {
          const inner = (
            <>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span
                  className="h-7 w-7 shrink-0 rounded-lg text-white text-[13px] font-semibold flex items-center justify-center tabular-nums"
                  style={{ backgroundColor: ch.tint }}
                >{ch.n}</span>
                <h2 className="font-display text-[14.5px] font-semibold text-ink leading-tight">{ch.title}</h2>
              </div>
              <p className="text-[12.5px] text-slate-dark leading-relaxed">{ch.desc}</p>
              <div className="mt-2 text-[12px] font-medium">
                {ch.href
                  ? <span className="text-info">Abrir guía →</span>
                  : <span className="text-slate/60">Próximamente</span>}
              </div>
            </>
          )
          return ch.href ? (
            <Link key={ch.n} href={ch.href} className="bg-paper border border-line rounded-xl shadow-card p-4 hover:border-info/40 transition-colors">
              {inner}
            </Link>
          ) : (
            <div key={ch.n} className="bg-paper border border-line rounded-xl shadow-card p-4 opacity-70">
              {inner}
            </div>
          )
        })}
      </div>
    </div>
  )
}
