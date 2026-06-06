import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'
import { BarHorizontal } from '@/components/charts/BarHorizontal'

const kpis = [
  { label: 'Esta semana',      value: '5',    delta: 'pendientes de aplicar',  tone: 'negative' as const },
  { label: 'Próximos 30 días', value: '25',   delta: '15 trimestrales · 7 semestrales · 3 anuales', tone: 'neutral' as const },
  { label: 'Aplicados (mes)',  value: '18',   delta: 'factor promedio 1,11',   tone: 'positive' as const },
  { label: 'IPC último',       value: '2,4%', delta: 'INDEC abril 2026',       tone: 'neutral'  as const },
]

const proyectadosPorMes = [
  { name: 'Junio',      value: 28 },
  { name: 'Julio',      value: 34 },
  { name: 'Agosto',     value: 22 },
  { name: 'Septiembre', value: 31 },
  { name: 'Octubre',    value: 26 },
  { name: 'Noviembre',  value: 29 },
]

const proximos = [
  { fecha: '08/06', contrato: '#142', inquilino: 'Pérez',     indice: 'IPC',  actual: 180000, factor: 1.1357, nuevo: 204426, cadencia: 'Trimestral' },
  { fecha: '12/06', contrato: '#087', inquilino: 'García',    indice: 'IPC',  actual: 250000, factor: 1.1357, nuevo: 283925, cadencia: 'Trimestral' },
  { fecha: '15/06', contrato: '#172', inquilino: 'Torres',    indice: 'ICL',  actual: 295000, factor: 1.0830, nuevo: 319485, cadencia: 'Semestral' },
  { fecha: '18/06', contrato: '#203', inquilino: 'Romero',    indice: 'IPC',  actual: 320000, factor: 1.1357, nuevo: 363424, cadencia: 'Semestral' },
  { fecha: '20/06', contrato: '#205', inquilino: 'Ortiz',     indice: 'IPC',  actual: 235000, factor: 1.1357, nuevo: 266890, cadencia: 'Trimestral' },
  { fecha: '22/06', contrato: '#155', inquilino: 'López',     indice: 'ICL',  actual: 195000, factor: 1.1182, nuevo: 218041, cadencia: 'Trimestral' },
  { fecha: '28/06', contrato: '#091', inquilino: 'Fernández', indice: 'IPC',  actual: 410000, factor: 1.1357, nuevo: 465607, cadencia: 'Trimestral' },
  { fecha: '02/07', contrato: '#118', inquilino: 'Sánchez',   indice: 'Casa Propia', actual: 285000, factor: 1.2842, nuevo: 365997, cadencia: 'Anual' },
]

const fmt = (n: number) => '$' + n.toLocaleString('es-AR')

export default function AumentosPage() {
  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <p className="text-[13px] text-slate-dark">
          <strong className="text-ink">Aumentos</strong> · IPC, ICL u otro índice según contrato
        </p>
        <button className="bg-ink text-paper px-4 py-2 rounded-sm text-[13px] font-medium hover:opacity-90 transition-opacity">
          Refrescar INDEC + BCRA
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
        ))}
      </div>

      <section className="mt-6 bg-paper border border-line rounded overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="font-display text-[16px] font-semibold text-ink">Aumentos proyectados por mes</h2>
            <p className="text-[12px] text-slate mt-0.5">Próximos 6 meses · cantidad de contratos a aumentar</p>
          </div>
          <Badge tone="neutral">170 aumentos proyectados</Badge>
        </div>
        <div className="p-5">
          <BarHorizontal
            data={proyectadosPorMes}
            unit="contrato"
            unitPlural="contratos"
            preserveOrder
            height={260}
          />
        </div>
      </section>

      <section className="mt-6 bg-paper border border-line rounded overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[16px] font-semibold text-ink">Próximos aumentos a aplicar</h2>
          <p className="text-[12px] text-slate mt-0.5">El factor se calcula compuesto sobre la ventana del índice asignado al contrato</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[900px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Fecha</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Contrato</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Inquilino</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Índice</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Actual</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Factor</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Nuevo</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Cadencia</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {proximos.map((a, i) => (
              <tr key={a.contrato} className={i % 2 === 0 ? 'bg-cream/40' : ''}>
                <td className="px-5 py-3 tabular-nums text-ink font-medium">{a.fecha}</td>
                <td className="px-5 py-3 tabular-nums text-slate-dark">{a.contrato}</td>
                <td className="px-5 py-3 text-ink">{a.inquilino}</td>
                <td className="px-5 py-3 text-slate-dark tabular-nums">{a.indice}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-dark">{fmt(a.actual)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink font-medium">{a.factor.toFixed(4)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink font-medium">{fmt(a.nuevo)}</td>
                <td className="px-5 py-3 text-slate-dark">{a.cadencia}</td>
                <td className="px-5 py-3">
                  <button className="text-[12px] text-ink hover:text-ink-soft font-medium underline-offset-2 hover:underline">Aplicar</button>
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
