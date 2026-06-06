import { KPICard } from '@/components/ui/KPICard'
import { Badge } from '@/components/ui/Badge'
import { BarHorizontal } from '@/components/charts/BarHorizontal'

const kpis = [
  { label: 'Emitidos (mes)', value: '232',    delta: '+18 vs mayo',           tone: 'positive' as const },
  { label: 'Monto total',    value: '$11,8 M', delta: 'recaudación de junio',  tone: 'neutral'  as const },
  { label: 'Pendientes',     value: '17',     delta: 'por emitir esta semana', tone: 'warn'     as const },
  { label: 'Último número',  value: '0001-00002847', delta: 'serie A',         tone: 'neutral'  as const },
]

const emitidosPorMes = [
  { name: 'Enero',   value: 198 },
  { name: 'Febrero', value: 207 },
  { name: 'Marzo',   value: 215 },
  { name: 'Abril',   value: 224 },
  { name: 'Mayo',    value: 214 },
  { name: 'Junio',   value: 232 },
]

const recibos = [
  { numero: '0001-00002847', fecha: '05/06', contrato: '#091', inquilino: 'Fernández', concepto: 'Alquiler junio 2026',    monto: 410000, estado: 'Emitido' },
  { numero: '0001-00002846', fecha: '05/06', contrato: '#087', inquilino: 'García',    concepto: 'Alquiler junio 2026',    monto: 250000, estado: 'Emitido' },
  { numero: '0001-00002845', fecha: '04/06', contrato: '#118', inquilino: 'Sánchez',   concepto: 'Alquiler junio 2026',    monto: 285000, estado: 'Emitido' },
  { numero: '0001-00002844', fecha: '04/06', contrato: '#155', inquilino: 'López',     concepto: 'Alquiler junio 2026',    monto: 195000, estado: 'Emitido' },
  { numero: '0001-00002843', fecha: '03/06', contrato: '#205', inquilino: 'Ortiz',     concepto: 'Alquiler + expensas',     monto: 263500, estado: 'Emitido' },
  { numero: '0001-00002842', fecha: '03/06', contrato: '#172', inquilino: 'Torres',    concepto: 'Alquiler junio 2026',    monto: 295000, estado: 'Emitido' },
  { numero: '0001-00002841', fecha: '02/06', contrato: '#143', inquilino: 'Domínguez', concepto: 'Alquiler + expensas',     monto: 274500, estado: 'Emitido' },
  { numero: '0001-00002840', fecha: '02/06', contrato: '#144', inquilino: 'Vázquez',   concepto: 'Alquiler junio 2026',    monto: 310000, estado: 'Emitido' },
  { numero: '0001-00002839', fecha: '02/06', contrato: '#203', inquilino: 'Romero',    concepto: 'Alquiler + punitorio',   monto: 327500, estado: 'Emitido' },
  { numero: '0001-00002838', fecha: '01/06', contrato: '#142', inquilino: 'Pérez',     concepto: 'Alquiler mayo 2026',     monto: 180000, estado: 'Anulado' },
]

const fmt = (n: number) => '$' + n.toLocaleString('es-AR')

export default function RecibosPage() {
  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <p className="text-[13px] text-slate-dark">
          <strong className="text-ink">Recibos</strong> · emitidos este mes y pendientes de emisión
        </p>
        <button className="bg-ink text-paper px-4 py-2 rounded-sm text-[13px] font-medium hover:opacity-90 transition-opacity">
          + Emitir recibo
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KPICard key={k.label} label={k.label} value={k.value} delta={k.delta} deltaTone={k.tone === 'warn' ? 'neutral' : k.tone} />
        ))}
      </div>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[16px] font-semibold text-ink">Recibos emitidos por mes</h2>
          <p className="text-[12px] text-slate mt-0.5">Últimos 6 meses · volumen mensual</p>
        </div>
        <div className="p-5">
          <BarHorizontal
            data={emitidosPorMes}
            unit="recibo"
            unitPlural="recibos"
            preserveOrder
            height={240}
          />
        </div>
      </section>

      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-[16px] font-semibold text-ink">Recibos recientes</h2>
            <p className="text-[12px] text-slate mt-0.5">Últimos 10 · ordenados por fecha de emisión</p>
          </div>
          <input
            type="text"
            placeholder="Buscar por número, inquilino o contrato..."
            className="h-9 w-80 px-3 rounded-md border border-line bg-cream text-[13px] outline-none focus:border-ink focus:bg-paper transition-colors"
          />
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[820px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Número</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Fecha</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Contrato</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Inquilino</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Concepto</th>
              <th className="text-right  px-5 py-2.5 label-cap font-medium">Monto</th>
              <th className="text-left   px-5 py-2.5 label-cap font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {recibos.map((r, i) => (
              <tr key={r.numero} className={`${i % 2 === 0 ? 'bg-cream/40' : ''} ${r.estado === 'Anulado' ? 'opacity-60' : ''}`}>
                <td className="px-5 py-3 tabular-nums text-ink font-medium">{r.numero}</td>
                <td className="px-5 py-3 tabular-nums text-slate-dark">{r.fecha}</td>
                <td className="px-5 py-3 tabular-nums text-slate-dark">{r.contrato}</td>
                <td className="px-5 py-3 text-ink">{r.inquilino}</td>
                <td className="px-5 py-3 text-slate-dark">{r.concepto}</td>
                <td className="px-5 py-3 text-right tabular-nums text-ink font-medium">{fmt(r.monto)}</td>
                <td className="px-5 py-3">
                  <Badge tone={r.estado === 'Emitido' ? 'success' : 'neutral'}>{r.estado}</Badge>
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
