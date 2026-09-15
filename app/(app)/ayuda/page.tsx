import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'

// ============================================================================
// Ayuda — indice de las guias, agrupado por cada cuanto se usa.
//
// Antes eran 12 tarjetas todas iguales, ordenadas por el orden en que se
// fueron escribiendo. El problema practico: la oficina usa cuatro de ellas
// todos los meses y abre "Crear un contrato" dos veces al mes, pero el indice
// las presentaba como si pesaran lo mismo — y la que mas se consulta
// (Referencia: "que significa esta columna") quedaba ultima de todas.
//
// Ahora van en dos bloques: el ciclo del mes primero, y las cosas que se hacen
// de vez en cuando despues. La numeracion sigue ese orden, y las flechas
// anterior/siguiente de cada capitulo encadenan DENTRO de su bloque — son dos
// recorridos, no uno solo de doce.
// ============================================================================

export const metadata = { title: 'Ayuda' }

interface Chapter { n: number; title: string; desc: string; href?: string; tint: string }

/** El ciclo del mes: lo que se hace y se consulta todos los meses. */
const MES_A_MES: Chapter[] = [
  { n: 1, title: 'Cargar el mes',                  desc: 'Cobros y Observaciones (arreglos / ajustes).',                          href: '/ayuda/cargar-el-mes', tint: '#0891B2' },
  { n: 2, title: '¿Dónde cargo cada cosa?',        desc: 'Extras, Movs., Expensas, Observación y Otros: cuál usar en cada caso.', href: '/ayuda/donde-cargo', tint: '#0891B2' },
  { n: 3, title: 'Cómo se calcula la liquidación', desc: 'De dónde sale el neto del propietario, término por término.',           href: '/ayuda/como-se-calcula', tint: '#16A34A' },
  { n: 4, title: 'Comisión y transferencia',       desc: 'ADMI, bancos, y enviar la liquidación al dueño.',                       href: '/ayuda/comision-transferencia', tint: '#16A34A' },
  { n: 5, title: 'Conciliación',                   desc: 'Qué movimientos están confirmados en el banco y cuáles no.',            href: '/ayuda/conciliacion', tint: '#3B82F6' },
  { n: 6, title: 'Diagnóstico y errores',          desc: 'Qué mirar cuando algo no cierra, y cómo resolverlo.',                   href: '/ayuda/diagnostico', tint: '#475569' },
  { n: 7, title: 'Referencia y glosario',          desc: 'Columnas de la planilla, términos y preguntas frecuentes.',             href: '/ayuda/referencia', tint: '#64748B' },
]

/** Altas, bajas y cambios: se hacen cuando aparece el caso, no todos los meses. */
const DE_VEZ_EN_CUANDO: Chapter[] = [
  { n: 8,  title: 'Crear un contrato',                desc: 'Dar de alta un contrato nuevo, campo por campo.',                       href: '/ayuda/crear-contrato', tint: '#0F766E' },
  { n: 9,  title: 'Editar un contrato',               desc: 'Planilla y ficha: %, participantes, vigencia, aumento, recordatorios.',  href: '/ayuda/editar-contrato', tint: '#0F766E' },
  { n: 10, title: 'Honorarios',                       desc: 'Fee de la inmobiliaria: cuotas, IVA y saldo.',                          href: '/ayuda/honorarios', tint: '#7C3AED' },
  { n: 11, title: 'Rescindir / reactivar contrato',   desc: 'Terminar un contrato y volver atrás si hace falta.',                    href: '/ayuda/rescindir-contrato', tint: '#DC2626' },
  { n: 12, title: 'Dar de baja / reactivar propiedad', desc: 'Sacar una propiedad de la cartera (reversible).',                      href: '/ayuda/dar-de-baja-propiedad', tint: '#16A34A' },
]

function ChapterCard({ ch }: { ch: Chapter }) {
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
    <Link href={ch.href} className="bg-paper border border-line rounded-xl shadow-card p-4 hover:border-info/40 transition-colors">
      {inner}
    </Link>
  ) : (
    <div className="bg-paper border border-line rounded-xl shadow-card p-4 opacity-70">
      {inner}
    </div>
  )
}

function Seccion({ titulo, sub, chapters }: { titulo: string; sub: string; chapters: Chapter[] }) {
  return (
    <section>
      <div className="mb-2.5">
        <h2 className="font-display text-[15px] font-semibold text-ink">{titulo}</h2>
        <p className="text-[12.5px] text-slate mt-0.5">{sub}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {chapters.map(ch => <ChapterCard key={ch.n} ch={ch} />)}
      </div>
    </section>
  )
}

export default function AyudaPage() {
  return (
    <div className="flex flex-col gap-5 lg:h-full lg:min-h-0 lg:overflow-auto pb-6">
      <BreadcrumbTitle name="Ayuda" />

      <header className="shrink-0">
        <nav className="text-[12px] text-slate flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Ayuda</span>
        </nav>
        <h1 className="text-[24px] font-semibold text-ink tracking-tight mt-1">Guía de uso</h1>
        <p className="text-[13.5px] text-slate-dark mt-1 max-w-2xl">
          Guías paso a paso, ordenadas por tarea. Arriba, lo del mes a mes; abajo, lo que se hace cuando
          aparece el caso. Si no sabés por dónde empezar, arrancá por{' '}
          <Link href="/ayuda/cargar-el-mes" className="text-info hover:underline">Cargar el mes</Link>.
        </p>
      </header>

      <Seccion
        titulo="El mes a mes"
        sub="El trabajo de todos los meses: cargar, revisar, liquidar y transferir."
        chapters={MES_A_MES}
      />

      <Seccion
        titulo="De vez en cuando"
        sub="Altas, bajas y cambios. Se consultan cuando aparece el caso."
        chapters={DE_VEZ_EN_CUANDO}
      />
    </div>
  )
}
