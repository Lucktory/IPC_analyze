import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'
import { DonutChart } from '@/components/charts/DonutChart'
import { BarHorizontal } from '@/components/charts/BarHorizontal'
import { fmtCompactARS, accentInk } from '@/components/charts/theme'

const kpis = [
  { label: 'Tiempo ahorrado',   value: '32 hs', delta: 'equivalente a 4 jornadas', tone: 'positive' as const },
  { label: 'Contratos activos', value: '247',   delta: '+3 este mes',              tone: 'neutral'  as const },
  { label: 'Atrasados',         value: '12',    delta: '$2,4 M pendiente',         tone: 'negative' as const },
  { label: 'Aumentos próximos', value: '5',     delta: 'esta semana',              tone: 'neutral'  as const },
]

// Cobro del mes — collapsed palette: success / slate / danger.
const cobroMes = [
  { name: 'Cobrado',   value: 11800000, color: '#16A34A' },
  { name: 'Pendiente', value:    880000, color: '#7D8491' },
  { name: 'Atrasado',  value:  1820000, color: '#DC2626' },
]
const totalEsperado = cobroMes.reduce((s, x) => s + x.value, 0)
const cobroPct = Math.round((cobroMes[0].value / totalEsperado) * 100)

const faltantePorBanco = [
  { name: 'Banco Galicia',   value:  70000 },
  { name: 'Banco Santander', value:      0 },
  { name: 'Banco Macro',     value: 210000 },
  { name: 'Banco BBVA',      value:      0 },
]

// Single-hue red urgency progression: light → mid → dark = newer → middle → oldest.
const atrasadosAntiguedad = [
  { name: '1 a 7 días',  value: 4, color: '#F87171' },
  { name: '8 a 15 días', value: 5, color: '#DC2626' },
  { name: '16+ días',    value: 3, color: '#991B1B' },
]

const aumentosPorSemana = [
  { name: 'Esta semana',  value: 5 },
  { name: 'Sem. próxima', value: 3 },
  { name: 'En 2 semanas', value: 4 },
  { name: 'En 3 semanas', value: 7 },
  { name: 'En 4 semanas', value: 6 },
]

const proximosAumentos = [
  { fecha: '08/06', contrato: '#142', inquilino: 'Pérez',     indice: 'IPC', actual: 180000, nuevo: 204426, cadencia: 'Trimestral' },
  { fecha: '12/06', contrato: '#087', inquilino: 'García',    indice: 'IPC', actual: 250000, nuevo: 283925, cadencia: 'Trimestral' },
  { fecha: '18/06', contrato: '#203', inquilino: 'Romero',    indice: 'IPC', actual: 320000, nuevo: 363424, cadencia: 'Semestral' },
  { fecha: '22/06', contrato: '#155', inquilino: 'López',     indice: 'ICL', actual: 195000, nuevo: 218041, cadencia: 'Trimestral' },
  { fecha: '28/06', contrato: '#091', inquilino: 'Fernández', indice: 'IPC', actual: 410000, nuevo: 465607, cadencia: 'Trimestral' },
]

const atrasados = [
  { inquilino: 'Pérez',    contrato: '#142', monto: 180000, dias: 15, punitorio: 4500 },
  { inquilino: 'Gómez',    contrato: '#088', monto: 210000, dias:  8, punitorio: 2800 },
  { inquilino: 'Martínez', contrato: '#073', monto: 165000, dias:  6, punitorio: 1650 },
]

const phase2Features = [
  {
    title: 'Portal inquilino',
    description: 'Acceso self-service para que cada inquilino vea sus pagos, vencimientos y recibos.',
  },
  {
    title: 'Recordatorios por WhatsApp',
    description: 'Aviso automático antes del vencimiento y al detectar un atraso.',
  },
  {
    title: 'Factura electrónica ARCA',
    description: 'Emisión automática de comprobantes según condición fiscal del propietario.',
  },
]

const fmt = (n: number) => '$' + n.toLocaleString('es-AR')

export default function DashboardPage() {
  return (
    <>
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
        <p className="text-[13px] text-slate-dark">
          Sábado 6 de junio · <strong className="text-ink font-medium">12 acciones</strong> requieren atención
        </p>
        <p className="label-cap text-slate">Junio 2026</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-paper border border-line rounded overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15px] font-medium text-ink">Cobro del mes</h2>
              <p className="text-[12px] text-slate mt-0.5">Junio 2026, esperado vs realidad</p>
            </div>
            <Badge tone="success">{cobroPct}% cobrado</Badge>
          </div>
          <div className="p-5">
            <DonutChart
              data={cobroMes}
              totalLabel="Cobrado del esperado"
              totalOverride={cobroPct + '%'}
              height={240}
            />
            <div className="mt-4 grid grid-cols-3 gap-3">
              {cobroMes.map((c) => (
                <div key={c.name} className="border-l-2 pl-3" style={{ borderColor: c.color }}>
                  <p className="label-cap">{c.name}</p>
                  <p className="font-display text-[15px] font-medium tabular-nums text-ink mt-0.5">
                    {fmtCompactARS(c.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-paper border border-line rounded overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15px] font-medium text-ink">Faltante por banco</h2>
              <p className="text-[12px] text-slate mt-0.5">Diferencia entre lo esperado y lo recibido</p>
            </div>
            <Badge tone="neutral">4 cuentas</Badge>
          </div>
          <div className="p-5">
            <BarHorizontal data={faltantePorBanco} height={240} preserveOrder barColor={accentInk} />
            <p className="text-[12px] text-slate mt-3">
              Macro concentra el 75% del faltante del mes.
            </p>
          </div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-paper border border-line rounded overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15px] font-medium text-ink">Atrasados por antigüedad</h2>
              <p className="text-[12px] text-slate mt-0.5">12 inquilinos atrasados al 6 de junio</p>
            </div>
            <Badge tone="danger">12 atrasados</Badge>
          </div>
          <div className="p-5">
            <DonutChart
              data={atrasadosAntiguedad}
              totalLabel="Inquilinos atrasados"
              totalOverride="12"
              unit="inquilino"
              unitPlural="inquilinos"
              height={240}
            />
          </div>
        </section>

        <section className="bg-paper border border-line rounded overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15px] font-medium text-ink">Aumentos próximos</h2>
              <p className="text-[12px] text-slate mt-0.5">Cantidad de contratos a aumentar por semana</p>
            </div>
            <Badge tone="neutral">25 próximos</Badge>
          </div>
          <div className="p-5">
            <BarHorizontal
              data={aumentosPorSemana}
              unit="aumento"
              unitPlural="aumentos"
              barColor={accentInk}
              preserveOrder
              height={240}
            />
          </div>
        </section>
      </div>

      <section className="mt-8 bg-paper border border-line rounded overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Próximos aumentos</h2>
          <p className="text-[12px] text-slate mt-0.5">Detalle por contrato, próximos 30 días</p>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Fecha</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Contrato</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Inquilino</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Índice</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Actual</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Nuevo estimado</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Cadencia</th>
            </tr>
          </thead>
          <tbody>
            {proximosAumentos.map((a, i) => (
              <tr key={a.contrato} className={i % 2 === 0 ? 'bg-cream/40' : ''}>
                <td className="px-5 py-3 tabular-nums text-ink font-medium">{a.fecha}</td>
                <td className="px-5 py-3 tabular-nums text-slate-dark">{a.contrato}</td>
                <td className="px-5 py-3 text-ink">{a.inquilino}</td>
                <td className="px-5 py-3 text-slate-dark tabular-nums">{a.indice}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-dark">{fmt(a.actual)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink font-medium">{fmt(a.nuevo)}</td>
                <td className="px-5 py-3 text-slate-dark">{a.cadencia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 bg-paper border border-line rounded overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="font-display text-[15px] font-medium text-ink">Inquilinos atrasados</h2>
            <p className="text-[12px] text-slate mt-0.5">Detalle por contrato, con punitorio acumulado</p>
          </div>
          <Badge tone="danger">3 más urgentes</Badge>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Inquilino</th>
              <th className="text-left  px-5 py-2.5 label-cap font-medium">Contrato</th>
              <th className="text-right px-5 py-2.5 label-cap font-medium">Monto adeudado</th>
              <th className="text-right px-5 py-2.5 label-cap font-medium">Días atrasado</th>
              <th className="text-right px-5 py-2.5 label-cap font-medium">Punitorio acumulado</th>
            </tr>
          </thead>
          <tbody>
            {atrasados.map((a, i) => (
              <tr key={a.contrato} className={i % 2 === 0 ? 'bg-cream/40' : ''}>
                <td className="px-5 py-3 text-ink font-medium">{a.inquilino}</td>
                <td className="px-5 py-3 tabular-nums text-slate-dark">{a.contrato}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink">{fmt(a.monto)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-danger font-medium">{a.dias}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-dark">{fmt(a.punitorio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-10">
        <p className="label-cap mb-3">Próximas integraciones</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {phase2Features.map((f) => (
            <div key={f.title} className="bg-paper border border-line rounded p-5">
              <div className="flex items-start justify-between mb-2 gap-3">
                <h3 className="font-display text-[14px] font-medium text-ink-soft">{f.title}</h3>
                <span className="text-[10px] uppercase tracking-wider text-slate font-medium">Próximamente</span>
              </div>
              <p className="text-[12px] text-slate leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
