import { KPICard } from '@/components/ui/KPICard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { BarHorizontal } from '@/components/charts/BarHorizontal'
import { DonutChart } from '@/components/charts/DonutChart'

const kpis = [
  { label: 'Ingresos del mes', value: '$11,8 M', delta: '+8,2% vs mayo',        tone: 'positive' as const },
  { label: 'Egresos del mes',  value: '$10,4 M', delta: 'liquidados a 24 dueños', tone: 'neutral'  as const },
  { label: 'Pendientes',       value: '$880 K',  delta: '5 pagos por confirmar', tone: 'neutral'  as const },
  { label: 'Atrasados',        value: '$1,8 M',  delta: '12 inquilinos',         tone: 'negative' as const },
]

const ingresosMensuales = [
  { name: 'Enero',   value: 9800000 },
  { name: 'Febrero', value: 10100000 },
  { name: 'Marzo',   value: 10800000 },
  { name: 'Abril',   value: 11200000 },
  { name: 'Mayo',    value: 10900000 },
  { name: 'Junio',   value: 11800000 },
]

const estadoPagos = [
  { name: 'Cobrados',  value: 232, color: '#16A34A' },
  { name: 'Pendientes', value: 5,  color: '#7D8491' },
  { name: 'Atrasados', value: 12,  color: '#DC2626' },
]

const pagos = [
  { fecha: '05/06', contrato: '#142', inquilino: 'Pérez',     monto: 180000, banco: 'Galicia',   direccion: 'IN',  estado: 'Pendiente' },
  { fecha: '05/06', contrato: '#087', inquilino: 'García',    monto: 250000, banco: 'Santander', direccion: 'IN',  estado: 'Pagado' },
  { fecha: '04/06', contrato: '#091', inquilino: 'Fernández', monto: 410000, banco: 'Galicia',   direccion: 'IN',  estado: 'Pagado' },
  { fecha: '04/06', contrato: '#118', inquilino: 'Sánchez',   monto: 285000, banco: 'Macro',     direccion: 'IN',  estado: 'Pagado' },
  { fecha: '03/06', contrato: '#155', inquilino: 'López',     monto: 195000, banco: 'BBVA',      direccion: 'IN',  estado: 'Pagado' },
  { fecha: '02/06', contrato: '#205', inquilino: 'Ortiz',     monto: 235000, banco: 'Santander', direccion: 'IN',  estado: 'Pagado' },
  { fecha: '02/06', contrato: '#172', inquilino: 'Torres',    monto: 295000, banco: 'Galicia',   direccion: 'IN',  estado: 'Pagado' },
  { fecha: '01/06', contrato: '#088', inquilino: 'Gómez',     monto: 210000, banco: 'Macro',     direccion: 'IN',  estado: 'Atrasado' },
  { fecha: '01/06', contrato: '#073', inquilino: 'Martínez',  monto: 165000, banco: 'BBVA',      direccion: 'IN',  estado: 'Atrasado' },
  { fecha: '03/06', contrato: '#091', inquilino: 'Bianchi (prop.)', monto: 377200, banco: 'Galicia', direccion: 'OUT', estado: 'Pagado' },
  { fecha: '03/06', contrato: '#118', inquilino: 'Romano (prop.)',  monto: 262200, banco: 'Macro',   direccion: 'OUT', estado: 'Pagado' },
  { fecha: '02/06', contrato: '#205', inquilino: 'Costa (prop.)',   monto: 216200, banco: 'Santander', direccion: 'OUT', estado: 'Pagado' },
]

const fmt = (n: number) => '$' + n.toLocaleString('es-AR')

export default function PagosPage() {
  return (
    <>
      <PageHeader
        title="Pagos"
        subtitle="Movimientos del mes · entradas y salidas"
        actions={
          <button className="bg-ink text-paper px-4 py-2 rounded-sm text-[13px] font-medium hover:opacity-90 transition-opacity">
            + Cargar pago
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-paper border border-line rounded overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-display text-[16px] font-semibold text-ink">Ingresos por mes</h2>
            <p className="text-[12px] text-slate mt-0.5">Últimos 6 meses · alquileres recaudados</p>
          </div>
          <div className="p-5">
            <BarHorizontal data={ingresosMensuales} preserveOrder height={260} />
          </div>
        </section>

        <section className="bg-paper border border-line rounded overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-display text-[16px] font-semibold text-ink">Estado de pagos</h2>
            <p className="text-[12px] text-slate mt-0.5">Junio 2026</p>
          </div>
          <div className="p-5">
            <DonutChart
              data={estadoPagos}
              totalLabel="Total contratos"
              totalOverride="249"
              format="integer"
              compact
              height={220}
            />
          </div>
        </section>
      </div>

      <section className="mt-6 bg-paper border border-line rounded overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-[16px] font-semibold text-ink">Movimientos recientes</h2>
            <p className="text-[12px] text-slate mt-0.5">Últimos 30 días</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-sm text-[12px] font-medium border border-line bg-cream-2 text-ink">Todos</button>
            <button className="px-3 py-1.5 rounded-sm text-[12px] font-medium border border-transparent text-slate-dark hover:text-ink transition-colors">Ingresos</button>
            <button className="px-3 py-1.5 rounded-sm text-[12px] font-medium border border-transparent text-slate-dark hover:text-ink transition-colors">Egresos</button>
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[820px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Fecha</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Contrato</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Parte</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Monto</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Banco</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Dirección</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((p, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-cream/40' : ''}>
                <td className="px-5 py-3 tabular-nums text-ink font-medium">{p.fecha}</td>
                <td className="px-5 py-3 tabular-nums text-slate-dark">{p.contrato}</td>
                <td className="px-5 py-3 text-ink">{p.inquilino}</td>
                <td className={`px-5 py-3 text-right tabular-nums font-medium ${p.direccion === 'IN' ? 'text-success' : 'text-slate-dark'}`}>
                  {p.direccion === 'IN' ? '+' : '-'}{fmt(p.monto)}
                </td>
                <td className="px-5 py-3 text-slate-dark">{p.banco}</td>
                <td className="px-5 py-3">
                  <Badge tone={p.direccion === 'IN' ? 'success' : 'neutral'}>{p.direccion}</Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={p.estado === 'Pagado' ? 'success' : p.estado === 'Atrasado' ? 'danger' : 'neutral'}>
                    {p.estado}
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
