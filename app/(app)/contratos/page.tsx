import Link from 'next/link'
import { KPICard } from '@/components/ui/KPICard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { DonutChart } from '@/components/charts/DonutChart'

const kpis = [
  { label: 'Total',       value: '247', delta: '+3 este mes',          tone: 'positive' as const },
  { label: 'Activos',     value: '241', delta: '97,5% del total',      tone: 'neutral'  as const },
  { label: 'Por vencer',  value: '8',   delta: 'en 60 días',           tone: 'neutral'  as const },
  { label: 'Vencidos',    value: '6',   delta: 'requieren acción',     tone: 'negative' as const },
]

const cadenciaDistribucion = [
  { name: 'Trimestral', value: 173, color: '#4A4F58' },
  { name: 'Semestral',  value: 49,  color: '#7D8491' },
  { name: 'Anual',      value: 25,  color: '#D6CFC1' },
]

const tiposDistribucion = [
  { name: 'Vivienda',  value: 209, color: '#4A4F58' },
  { name: 'Comercial', value: 38,  color: '#D6CFC1' },
]

const contratos = [
  { id: '#142', inquilino: 'Pérez',     direccion: 'Av. Santa Fe 2480, Palermo',        alquiler: 180000, expensas: 28500, indice: 'IPC',         prox: '08/06', cadencia: 'Trimestral', estado: 'Activo' },
  { id: '#143', inquilino: 'Domínguez', direccion: 'Honduras 4521, Palermo',            alquiler: 245000, expensas: 29500, indice: 'IPC',         prox: '15/07', cadencia: 'Trimestral', estado: 'Activo' },
  { id: '#144', inquilino: 'Vázquez',   direccion: 'Av. Cabildo 1850, Belgrano',        alquiler: 310000, expensas: 35000, indice: 'ICL',         prox: '22/08', cadencia: 'Semestral',  estado: 'Activo' },
  { id: '#087', inquilino: 'García',    direccion: 'Av. Las Heras 1920, Recoleta',      alquiler: 250000, expensas: 38000, indice: 'IPC',         prox: '12/06', cadencia: 'Trimestral', estado: 'Activo' },
  { id: '#155', inquilino: 'López',     direccion: 'Soler 4188, Villa Crespo',          alquiler: 195000, expensas: 22000, indice: 'ICL',         prox: '22/06', cadencia: 'Trimestral', estado: 'Activo' },
  { id: '#073', inquilino: 'Martínez',  direccion: 'Salguero 2435, Palermo',            alquiler: 165000, expensas: 24000, indice: 'IPC',         prox: '04/07', cadencia: 'Trimestral', estado: 'Atrasado' },
  { id: '#091', inquilino: 'Fernández', direccion: 'Av. Pueyrredón 1550, Recoleta',     alquiler: 410000, expensas: 42000, indice: 'IPC',         prox: '28/06', cadencia: 'Trimestral', estado: 'Activo' },
  { id: '#203', inquilino: 'Romero',    direccion: 'Av. Corrientes 5220, Villa Crespo', alquiler: 320000, expensas: 31500, indice: 'IPC',         prox: '18/06', cadencia: 'Semestral',  estado: 'Activo' },
  { id: '#118', inquilino: 'Sánchez',   direccion: 'Charcas 3290, Palermo',             alquiler: 285000, expensas: 26500, indice: 'Casa Propia', prox: '02/08', cadencia: 'Anual',      estado: 'Activo' },
  { id: '#088', inquilino: 'Gómez',     direccion: 'Aráoz 950, Almagro',                alquiler: 210000, expensas: 18500, indice: 'IPC',         prox: '10/07', cadencia: 'Trimestral', estado: 'Atrasado' },
  { id: '#172', inquilino: 'Torres',    direccion: 'Gorriti 4555, Palermo',             alquiler: 295000, expensas: 33000, indice: 'IPC',         prox: '14/09', cadencia: 'Semestral',  estado: 'Activo' },
  { id: '#205', inquilino: 'Ortiz',     direccion: 'Av. Rivadavia 7820, Caballito',     alquiler: 235000, expensas: 28500, indice: 'IPC',         prox: '20/06', cadencia: 'Trimestral', estado: 'Activo' },
]

const fmt = (n: number) => '$' + n.toLocaleString('es-AR')

export default function ContratosPage() {
  return (
    <>
      <PageHeader
        title="Contratos"
        subtitle="247 contratos activos · gestión integral"
        actions={
          <button className="bg-ink text-paper px-4 py-2 rounded-sm text-[13px] font-medium hover:opacity-90 transition-opacity">
            + Nuevo contrato
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-display text-[16px] font-semibold text-ink">Distribución por cadencia</h2>
            <p className="text-[12px] text-slate mt-0.5">Frecuencia de ajuste IPC en cartera</p>
          </div>
          <div className="p-5">
            <DonutChart
              data={cadenciaDistribucion}
              totalLabel="Contratos activos"
              totalOverride="247"
              unit="contrato"
              unitPlural="contratos"
              height={240}
            />
          </div>
        </section>

        <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-display text-[16px] font-semibold text-ink">Tipo de propiedad</h2>
            <p className="text-[12px] text-slate mt-0.5">Vivienda vs comercial</p>
          </div>
          <div className="p-5">
            <DonutChart
              data={tiposDistribucion}
              totalLabel="Total"
              totalOverride="247"
              unit="contrato"
              unitPlural="contratos"
              height={240}
            />
          </div>
        </section>
      </div>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-1">
            <input
              type="text"
              placeholder="Buscar por inquilino, dirección o ID..."
              className="h-9 flex-1 max-w-[320px] px-3 rounded-md border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors"
            />
            <select className="h-9 px-3 rounded-md border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors">
              <option>Todos los estados</option>
              <option>Activo</option>
              <option>Atrasado</option>
              <option>Por vencer</option>
            </select>
          </div>
          <p className="text-[12px] text-slate">Mostrando 1-12 de 247</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[860px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Contrato</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Inquilino</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Dirección</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Alquiler</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Expensas</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Índice</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Próx. aumento</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {contratos.map((c, i) => (
              <tr
                key={c.id}
                className={
                  (c.estado === 'Atrasado'
                    ? 'bg-danger/[0.08] hover:bg-danger/[0.14]'
                    : (i % 2 === 0 ? 'bg-cream/40 ' : '') + 'hover:bg-cream-2') +
                  ' transition-colors'
                }
              >
                <td className="px-5 py-3 tabular-nums text-slate-dark font-medium">{c.id}</td>
                <td className="px-5 py-3">
                  <Link
                    href={`/inquilinos/${c.id.replace('#', '')}`}
                    className="text-ink font-medium hover:underline underline-offset-4"
                  >
                    {c.inquilino}
                  </Link>
                </td>
                <td className="px-5 py-3 text-slate-dark">{c.direccion}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink">{fmt(c.alquiler)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-dark">{fmt(c.expensas)}</td>
                <td className="px-5 py-3 text-slate-dark tabular-nums">{c.indice}</td>
                <td className="px-5 py-3 tabular-nums text-slate-dark">{c.prox}</td>
                <td className="px-5 py-3">
                  <Badge tone={c.estado === 'Activo' ? 'success' : c.estado === 'Atrasado' ? 'danger' : 'neutral'}>
                    {c.estado}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
    </>
  )
}
