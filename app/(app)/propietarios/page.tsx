import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'

const kpis = [
  { label: 'Total',              value: '15',        delta: 'propietarios en cartera',  tone: 'neutral'  as const },
  { label: 'Propiedades',        value: '247',       delta: 'unidades administradas',   tone: 'neutral'  as const },
  { label: 'Ingresos del mes',   value: '$11,8 M',   delta: 'recaudado a junio',        tone: 'positive' as const },
  { label: 'Comisión promedio',  value: '8,5%',      delta: 'sobre alquileres brutos',  tone: 'neutral'  as const },
]

const propietarios = [
  { slug: 'bianchi',  foto: 'https://i.pravatar.cc/64?img=33', nombre: 'Marco Bianchi',    propiedades: 23, ingresos: 4250000, comision: 8,  banco: 'Galicia'   },
  { slug: 'romano',   foto: 'https://i.pravatar.cc/64?img=42', nombre: 'Lucía Romano',     propiedades: 18, ingresos: 3680000, comision: 10, banco: 'Santander' },
  { slug: 'costa',    foto: 'https://i.pravatar.cc/64?img=47', nombre: 'Andrea Costa',     propiedades: 14, ingresos: 2470000, comision: 8,  banco: 'BBVA'      },
  { slug: 'esposito', foto: 'https://i.pravatar.cc/64?img=54', nombre: 'Diego Esposito',   propiedades: 21, ingresos: 4120000, comision: 8,  banco: 'Galicia'   },
  { slug: 'russo',    foto: 'https://i.pravatar.cc/64?img=29', nombre: 'Cecilia Russo',    propiedades: 12, ingresos: 2080000, comision: 9,  banco: 'Santander' },
  { slug: 'ferrari',  foto: 'https://i.pravatar.cc/64?img=36', nombre: 'Patricia Ferrari', propiedades: 19, ingresos: 3540000, comision: 10, banco: 'Macro'     },
  { slug: 'greco',    foto: 'https://i.pravatar.cc/64?img=51', nombre: 'Sebastián Greco',  propiedades: 15, ingresos: 2810000, comision: 8,  banco: 'Galicia'   },
  { slug: 'marino',   foto: 'https://i.pravatar.cc/64?img=43', nombre: 'Florencia Marino', propiedades: 17, ingresos: 3120000, comision: 9,  banco: 'BBVA'      },
  { slug: 'bruno',    foto: 'https://i.pravatar.cc/64?img=14', nombre: 'Hernán Bruno',     propiedades: 10, ingresos: 1860000, comision: 8,  banco: 'Macro'     },
  { slug: 'gallo',    foto: 'https://i.pravatar.cc/64?img=25', nombre: 'Mónica Gallo',     propiedades: 13, ingresos: 2410000, comision: 8,  banco: 'Santander' },
  { slug: 'riva',     foto: 'https://i.pravatar.cc/64?img=52', nombre: 'Carlos Riva',      propiedades: 22, ingresos: 4380000, comision: 7,  banco: 'Galicia'   },
  { slug: 'mancini',  foto: 'https://i.pravatar.cc/64?img=46', nombre: 'Daniela Mancini',  propiedades: 11, ingresos: 1980000, comision: 10, banco: 'BBVA'      },
]

const fmt = (n: number) => '$' + n.toLocaleString('es-AR')

export default function PropietariosPage() {
  return (
    <>
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
        <p className="text-[13px] text-slate-dark">
          <strong className="text-ink font-medium">Propietarios</strong> · 15 dueños en cartera, 247 propiedades
        </p>
        <button className="bg-ink text-paper px-4 py-2 rounded-sm text-[13px] font-medium hover:opacity-90 transition-opacity">
          + Nuevo propietario
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
        ))}
      </div>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-1">
            <input
              type="text"
              placeholder="Buscar propietario por nombre..."
              className="h-9 flex-1 max-w-[320px] px-3 rounded-sm border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors"
            />
            <select className="h-9 px-3 rounded-sm border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors">
              <option>Todos los bancos</option>
              <option>Galicia</option>
              <option>Santander</option>
              <option>Macro</option>
              <option>BBVA</option>
            </select>
          </div>
          <p className="text-[12px] text-slate">Mostrando 1-12 de 15</p>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Propietario</th>
              <th className="text-right px-5 py-2.5 label-cap font-medium">Propiedades</th>
              <th className="text-right px-5 py-2.5 label-cap font-medium">Ingresos del mes</th>
              <th className="text-right px-5 py-2.5 label-cap font-medium">Comisión</th>
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Banco</th>
            </tr>
          </thead>
          <tbody>
            {propietarios.map((p, idx) => (
              <tr key={p.slug} className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} hover:bg-cream-2 transition-colors`}>
                <td className="px-5 py-3">
                  <Link href={`/propietarios/${p.slug}`} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.foto} alt={p.nombre} className="w-7 h-7 rounded-full object-cover border border-line shrink-0" />
                    <span className="text-ink font-medium hover:underline underline-offset-4">{p.nombre}</span>
                  </Link>
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-ink">{p.propiedades}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink">{fmt(p.ingresos)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-dark">{p.comision}%</td>
                <td className="px-5 py-3 text-slate-dark">{p.banco}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
