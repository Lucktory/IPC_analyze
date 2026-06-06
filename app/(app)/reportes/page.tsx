import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { DonutChart } from '@/components/charts/DonutChart'
import { BarHorizontal } from '@/components/charts/BarHorizontal'

const cumplimientoBanco = [
  { name: 'Banco Santander', value: 100 },
  { name: 'Banco BBVA',      value: 100 },
  { name: 'Banco Galicia',   value: 94 },
  { name: 'Banco Macro',     value: 66 },
]

const ingresosPorBanco = [
  { name: 'Banco Galicia',   value: 4250000 },
  { name: 'Banco Santander', value: 2840000 },
  { name: 'Banco Macro',     value: 2920000 },
  { name: 'Banco BBVA',      value: 1790000 },
]

const cadenciaDistribucion = [
  { name: 'Trimestral', value: 173, color: '#4A4F58' },
  { name: 'Semestral',  value: 49,  color: '#7D8491' },
  { name: 'Anual',      value: 25,  color: '#D6CFC1' },
]

const tipoContrato = [
  { name: 'Vivienda',  value: 209, color: '#4A4F58' },
  { name: 'Comercial', value: 38,  color: '#D6CFC1' },
]

const topContratos = [
  { name: 'Fernández #091',  value: 410000 },
  { name: 'Romero #203',     value: 320000 },
  { name: 'Torres #172',     value: 295000 },
  { name: 'Sánchez #118',    value: 285000 },
  { name: 'García #087',     value: 250000 },
  { name: 'Domínguez #143',  value: 245000 },
  { name: 'Ortiz #205',      value: 235000 },
  { name: 'Gómez #088',      value: 210000 },
  { name: 'López #155',      value: 195000 },
  { name: 'Pérez #142',      value: 180000 },
]

export default function ReportesPage() {
  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle="Análisis operativo y financiero · junio 2026"
        actions={
          <button className="border border-line text-ink px-4 py-2 rounded-sm text-[13px] font-medium hover:bg-cream-2 transition-colors">
            Exportar PDF
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-paper border border-line rounded overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <div>
              <h2 className="font-display text-[16px] font-semibold text-ink">Cumplimiento por banco</h2>
              <p className="text-[12px] text-slate mt-0.5">% de cobros recibidos del esperado · junio</p>
            </div>
            <Badge tone="danger">Macro debajo del umbral</Badge>
          </div>
          <div className="p-5">
            <BarHorizontal
              data={cumplimientoBanco}
              format="percent"
              barColor="#16A34A"
              preserveOrder
              height={240}
            />
          </div>

        </section>

        <section className="bg-paper border border-line rounded overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-display text-[16px] font-semibold text-ink">Ingresos por banco</h2>
            <p className="text-[12px] text-slate mt-0.5">Acumulado · últimos 6 meses</p>
          </div>
          <div className="p-5">
            <BarHorizontal data={ingresosPorBanco} preserveOrder height={240} />
          </div>
        </section>

        <section className="bg-paper border border-line rounded overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-display text-[16px] font-semibold text-ink">Cadencia de ajuste</h2>
            <p className="text-[12px] text-slate mt-0.5">Distribución de contratos por frecuencia IPC</p>
          </div>
          <div className="p-5">
            <DonutChart
              data={cadenciaDistribucion}
              totalLabel="Cartera total"
              totalOverride="247"
              unit="contrato"
              unitPlural="contratos"
              height={240}
            />
          </div>
        </section>

        <section className="bg-paper border border-line rounded overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-display text-[16px] font-semibold text-ink">Tipo de propiedad</h2>
            <p className="text-[12px] text-slate mt-0.5">Vivienda vs comercial</p>
          </div>
          <div className="p-5">
            <DonutChart
              data={tipoContrato}
              totalLabel="Cartera total"
              totalOverride="247"
              unit="contrato"
              unitPlural="contratos"
              height={240}
            />
          </div>
        </section>
      </div>

      <section className="mt-6 bg-paper border border-line rounded overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[16px] font-semibold text-ink">Top 10 contratos por monto</h2>
          <p className="text-[12px] text-slate mt-0.5">Alquileres más altos de la cartera</p>
        </div>
        <div className="p-5">
          <BarHorizontal data={topContratos} height={340} />
        </div>
      </section>
    </>
  )
}
