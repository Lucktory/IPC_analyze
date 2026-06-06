import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'

const kpis = [
  { label: 'Total',           value: '240', delta: 'inquilinos en cartera',     tone: 'neutral'  as const },
  { label: 'Al día',          value: '221', delta: '92% del total',             tone: 'positive' as const },
  { label: 'Atrasados',       value: '12',  delta: '$2,4 M pendiente',          tone: 'negative' as const },
  { label: 'Por renovar',     value: '7',   delta: 'contrato vence en 60 días', tone: 'neutral'  as const },
]

const inquilinos = [
  { id: '142', foto: 'https://i.pravatar.cc/64?img=12', nombre: 'Juan Pérez',         contrato: '#142', direccion: 'Av. Santa Fe 2480, Palermo',        alquiler: 180000, estado: 'Atrasado' },
  { id: '143', foto: 'https://i.pravatar.cc/64?img=23', nombre: 'Lucía Domínguez',    contrato: '#143', direccion: 'Honduras 4521, Palermo',            alquiler: 245000, estado: 'Al día' },
  { id: '144', foto: 'https://i.pravatar.cc/64?img=15', nombre: 'Martín Vázquez',     contrato: '#144', direccion: 'Av. Cabildo 1850, Belgrano',        alquiler: 310000, estado: 'Al día' },
  { id: '087', foto: 'https://i.pravatar.cc/64?img=49', nombre: 'Sofía García',       contrato: '#087', direccion: 'Av. Las Heras 1920, Recoleta',      alquiler: 250000, estado: 'Al día' },
  { id: '155', foto: 'https://i.pravatar.cc/64?img=58', nombre: 'Diego López',        contrato: '#155', direccion: 'Soler 4188, Villa Crespo',          alquiler: 195000, estado: 'Al día' },
  { id: '073', foto: 'https://i.pravatar.cc/64?img=44', nombre: 'Cecilia Martínez',   contrato: '#073', direccion: 'Salguero 2435, Palermo',            alquiler: 165000, estado: 'Atrasado' },
  { id: '091', foto: 'https://i.pravatar.cc/64?img=68', nombre: 'Federico Fernández', contrato: '#091', direccion: 'Av. Pueyrredón 1550, Recoleta',     alquiler: 410000, estado: 'Al día' },
  { id: '203', foto: 'https://i.pravatar.cc/64?img=20', nombre: 'Valeria Romero',     contrato: '#203', direccion: 'Av. Corrientes 5220, Villa Crespo', alquiler: 320000, estado: 'Al día' },
  { id: '118', foto: 'https://i.pravatar.cc/64?img=53', nombre: 'Pablo Sánchez',      contrato: '#118', direccion: 'Charcas 3290, Palermo',             alquiler: 285000, estado: 'Al día' },
  { id: '088', foto: 'https://i.pravatar.cc/64?img=45', nombre: 'Carolina Gómez',     contrato: '#088', direccion: 'Aráoz 950, Almagro',                alquiler: 210000, estado: 'Atrasado' },
  { id: '172', foto: 'https://i.pravatar.cc/64?img=11', nombre: 'Martín Torres',      contrato: '#172', direccion: 'Gorriti 4555, Palermo',             alquiler: 295000, estado: 'Al día' },
  { id: '205', foto: 'https://i.pravatar.cc/64?img=60', nombre: 'Hernán Ortiz',       contrato: '#205', direccion: 'Av. Rivadavia 7820, Caballito',     alquiler: 235000, estado: 'Al día' },
]

const fmt = (n: number) => '$' + n.toLocaleString('es-AR')

export default function InquilinosPage() {
  return (
    <>
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
        <p className="text-[13px] text-slate-dark">
          <strong className="text-ink font-medium">Inquilinos</strong> · 240 activos en cartera
        </p>
        <button className="bg-ink text-paper px-4 py-2 rounded-sm text-[13px] font-medium hover:opacity-90 transition-opacity">
          + Nuevo inquilino
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
        ))}
      </div>

      <section className="mt-6 bg-paper border border-line rounded overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-1">
            <input
              type="text"
              placeholder="Buscar por nombre, contrato o dirección..."
              className="h-9 flex-1 max-w-[320px] px-3 rounded-sm border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors"
            />
            <select className="h-9 px-3 rounded-sm border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors">
              <option>Todos los estados</option>
              <option>Al día</option>
              <option>Atrasado</option>
            </select>
          </div>
          <p className="text-[12px] text-slate">Mostrando 1-12 de 240</p>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Inquilino</th>
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Contrato</th>
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Dirección</th>
              <th className="text-right px-5 py-2.5 label-cap font-medium">Alquiler</th>
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {inquilinos.map((i, idx) => (
              <tr
                key={i.id}
                className={
                  (i.estado === 'Atrasado'
                    ? 'bg-danger/[0.04] hover:bg-danger/[0.08]'
                    : (idx % 2 === 0 ? 'bg-cream/40 ' : '') + 'hover:bg-cream-2') +
                  ' transition-colors'
                }
              >
                <td className="px-5 py-3">
                  <Link href={`/inquilinos/${i.id}`} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={i.foto} alt={i.nombre} className="w-7 h-7 rounded-full object-cover border border-line shrink-0" />
                    <span className="text-ink font-medium hover:underline underline-offset-4">{i.nombre}</span>
                  </Link>
                </td>
                <td className="px-5 py-3 tabular-nums text-slate-dark">{i.contrato}</td>
                <td className="px-5 py-3 text-slate-dark">{i.direccion}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink">{fmt(i.alquiler)}</td>
                <td className="px-5 py-3">
                  <Badge tone={i.estado === 'Al día' ? 'success' : 'danger'}>{i.estado}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
