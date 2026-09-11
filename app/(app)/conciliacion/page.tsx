// ============================================================================
// /conciliacion — reconciliation board. The LEFT panel ("Movimientos del
// sistema") is real: every transaction of the period, with its bank-confirmed
// status derived from transactions.bank_date (set = confirmed on the bank).
// The RIGHT panel ("Extracto bancario") is an honest empty state: there is no
// bank-statement import in the system yet, so we do NOT fabricate statement
// lines — cross-matching against an imported extracto is a future feature.
// ============================================================================

import Link from 'next/link'
import {
  CheckCircle2, Clock, Scale, ArrowDownLeft, ArrowUpRight,
  FileUp, ChevronRight,
} from 'lucide-react'
import { PeriodSelect } from '@/components/charts/panel/PeriodSelect'
import { getConciliacionMovimientos, type ConciliacionMov } from '@/lib/conciliacion/queries'
import { getDashboardPeriod, getPeriodsWithData } from '@/lib/dashboard/queries'
import { buildPeriodTabs, periodLabel } from '@/lib/period'
import { fmtMoney as fmt } from '@/lib/format'

export const dynamic    = 'force-dynamic'
export const fetchCache = 'force-no-store'

const DATE_LABEL = (s: string | null) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

interface PageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function ConciliacionPage({ searchParams }: PageProps) {
  const sp = await searchParams

  const [latest, dataPeriods] = await Promise.all([getDashboardPeriod(), getPeriodsWithData()])
  const validReq = sp.period && /^\d{4}-\d{2}-01$/.test(sp.period) ? sp.period : null
  const period   = validReq ?? latest
  const selectorPeriods = buildPeriodTabs(dataPeriods, period, 3)

  const movs = await getConciliacionMovimientos(period)

  const conciliados = movs.filter(m => m.conciliado)
  const pendientes  = movs.filter(m => !m.conciliado)
  const pctConc = movs.length > 0 ? (conciliados.length / movs.length) * 100 : 0

  // Montos SOLO de lo que falta confirmar, y separados por direccion.
  //
  // Antes esta pagina mostraba un "Total" que sumaba entradas y salidas juntas.
  // No era un error de cuenta: transactions.amount siempre se guarda positivo
  // (check (amount > 0)) y la direccion vive en transaction_types.direction, asi
  // que sumar sin mirar la direccion contaba el mismo peso dos veces — una al
  // entrar y otra al salir. El numero SUBIA a medida que se pagaba, o sea que
  // crecia justo cuando la plata se iba.
  //
  // No se reemplazo por un total bien calculado, se saco. Esta pagina es un
  // tablero de ESTADO ("que movimientos estan confirmados en el banco"), no un
  // resumen de plata: un monto agregado aca no contesta ninguna pregunta. Y un
  // "Ingresos" propio ademas chocaria con el de la planilla, porque aquel filtra
  // por affects_liquidacion (DEPOSIT_IN queda afuera) y esta consulta no filtra
  // nada: darian distinto siempre que haya un deposito de garantia.
  //
  // Lo unico que si sirve es lo que falta confirmar, separado: perseguir una
  // entrada sin confirmar ("entro el alquiler?") y una salida sin confirmar
  // ("salio la transferencia?") son dos tareas distintas.
  const sumByDir = (rows: ConciliacionMov[], dir: 'IN' | 'OUT') =>
    rows.filter(m => m.direction === dir).reduce((s, m) => s + m.amount, 0)
  const pendIn  = sumByDir(pendientes, 'IN')
  const pendOut = sumByDir(pendientes, 'OUT')

  // Totales del mes, una columna por direccion — el metodo de la planilla de
  // papel: no se suma una columna con la otra, se suma cada una y se muestran
  // las dos.
  //
  // Se llaman ENTRADAS y SALIDAS, no "ingresos", a proposito. Esta pagina
  // cuenta todo lo que pasa por el banco, depositos de garantia incluidos; la
  // planilla filtra por affects_liquidacion y los deja afuera. Son dos
  // preguntas distintas, asi que llevan dos nombres distintos: si las dos se
  // llamaran "Ingresos" pareceria que el sistema se contradice.
  const totalIn  = sumByDir(movs, 'IN')
  const totalOut = sumByDir(movs, 'OUT')

  const kpis = [
    { Icon: CheckCircle2, color: '#16A34A', label: 'Conciliados',  value: String(conciliados.length), sub: 'confirmados en banco' },
    { Icon: Clock,        color: '#F59E0B', label: 'Sin conciliar', value: String(pendientes.length),  sub: pendientes.length > 0 ? `${fmt(pendIn)} a cobrar · ${fmt(pendOut)} a pagar` : 'todo confirmado' },
    { Icon: Scale,        color: '#3B82F6', label: 'Cobertura',     value: `${pctConc.toFixed(0)}%`,   sub: `${conciliados.length} de ${movs.length} movimientos` },
  ]

  return (
    <div className="space-y-5 pb-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold text-ink tracking-tight">Conciliación</h1>
          <nav className="text-[12px] text-slate mt-1 flex items-center gap-1.5">
            <Link href="/dashboard" className="text-info hover:underline">Inicio</Link>
            <span className="text-slate/50">/</span>
            <span className="text-slate-dark">Conciliación</span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelect current={period} periods={selectorPeriods} basePath="/conciliacion" extraQuery="" />
          <span
            title="La importación de extractos estará disponible próximamente"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line bg-cream-2 text-slate/70 text-[13px] font-medium cursor-not-allowed select-none"
          >
            <FileUp size={16} /> Importar extracto
          </span>
        </div>
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-2xl border border-line border-l-[5px] bg-paper p-5 flex items-center gap-4 shadow-card" style={{ borderLeftColor: k.color }}>
            <span className="w-14 h-14 rounded-xl grid place-items-center shrink-0 text-white" style={{ backgroundColor: k.color }}>
              <k.Icon size={26} />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] text-slate-dark">{k.label}</p>
              <p className="text-[30px] font-bold text-ink leading-none tabular-nums mt-0.5">{k.value}</p>
              <p className="text-[12px] text-slate mt-1 truncate">{k.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Two-panel reconciliation board */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT — system movements (real) */}
        <div className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[15px] font-semibold text-ink">Movimientos del sistema</h2>
              <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-cream-2 text-slate-dark text-[12px] font-semibold tabular-nums">{movs.length}</span>
            </div>
            <span className="text-[11px] text-slate">registrados en el período</span>
          </div>
          <div className="overflow-auto max-h-[calc(100vh-320px)]">
            {movs.length > 0 ? (
              <table className="w-full text-[13px] min-w-[560px]">
                <thead className="sticky top-0 z-10 bg-paper">
                  <tr className="border-b border-line">
                    <th className="label-cap font-medium text-slate text-left  px-4 py-2.5 w-[70px]">Fecha</th>
                    <th className="label-cap font-medium text-slate text-left  px-4 py-2.5">Concepto</th>
                    <th className="label-cap font-medium text-slate text-left  px-4 py-2.5">Banco</th>
                    <th className="label-cap font-medium text-slate text-right px-4 py-2.5">Monto</th>
                    <th className="label-cap font-medium text-slate text-center px-3 py-2.5 w-[76px]">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {movs.map(m => <MovRow key={m.id} m={m} viewedPeriod={period} />)}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-[14px] text-slate">No hay movimientos en este período</div>
            )}
          </div>
          {movs.length > 0 && (
            <div className="px-5 py-3 border-t border-line bg-header shrink-0 text-[12px]">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-slate-dark">
                  <span className="text-success font-medium">{conciliados.length} conciliados</span>
                  <span className="text-slate/50"> · </span>
                  <span className="text-warn font-medium">{pendientes.length} pendientes</span>
                </span>
                <span className="tabular-nums text-slate-dark">
                  Entradas <span className="text-success font-semibold">{fmt(totalIn)}</span>
                  <span className="text-slate/50"> · </span>
                  Salidas <span className="text-danger font-semibold">{fmt(totalOut)}</span>
                  <span className="text-slate/50"> · </span>
                  <span className="text-slate">{movs.length} movimientos</span>
                </span>
              </div>
              <p className="text-[10.5px] text-slate italic mt-1 leading-snug">
                Todo lo que pasó por el banco este mes, depósitos de garantía incluidos.
                Los ingresos de la liquidación están en la planilla.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT — bank statement (honest empty state) */}
        <div className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between gap-2">
            <h2 className="font-display text-[15px] font-semibold text-ink">Extracto bancario</h2>
            <span className="text-[11px] text-slate">para cruzar con el sistema</span>
          </div>
          <div className="flex-1 grid place-items-center p-10 text-center">
            <div className="max-w-[340px]">
              <span className="w-16 h-16 rounded-2xl grid place-items-center mx-auto bg-cream-2 text-slate">
                <FileUp size={30} />
              </span>
              <p className="text-[15px] font-semibold text-ink mt-4">Sin extracto importado</p>
              <p className="text-[13px] text-slate mt-1.5 leading-relaxed">
                Todavía no se puede cruzar contra un extracto bancario: la importación
                de extractos y el cruce automático estarán disponibles próximamente.
              </p>
              <p className="text-[12px] text-slate/80 mt-3">
                Mientras tanto, el estado de cada movimiento se toma de la
                <span className="text-slate-dark font-medium"> fecha de banco</span> registrada en el sistema.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pendientes shortcut — where to confirm them */}
      {pendientes.length > 0 && (
        <Link
          href={`/liquidacion?period=${period}`}
          className="flex items-center justify-between gap-3 bg-paper border border-line rounded-2xl shadow-card px-5 py-4 hover:border-info/40 transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-warn/15 text-warn"><Clock size={20} /></span>
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-ink">{pendientes.length} movimiento{pendientes.length === 1 ? '' : 's'} sin conciliar</p>
              <p className="text-[12px] text-slate">Confirmá la fecha de banco en la Liquidación para marcarlos como conciliados</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-info shrink-0">
            Ir a Liquidación <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      )}
    </div>
  )
}

function MovRow({ m, viewedPeriod }: { m: ConciliacionMov; viewedPeriod: string }) {
  const isIn = m.direction === 'IN'
  // La plata entro este mes pero el pago corresponde a otro (p.ej. termino de
  // pagar Agosto el 5 de Septiembre). Sin avisarlo, la fila parece un error de
  // carga; avisado, es exactamente lo que tiene que pasar.
  const otroPeriodo = m.periodo !== viewedPeriod
  const signed = (isIn ? '+' : '−') + fmt(m.amount).replace('$', '$ ').replace('-', '')
  return (
    <tr className="border-b border-line/60 last:border-0 hover:bg-cream-2 transition-colors">
      <td className="px-4 py-2.5 text-slate-dark tabular-nums whitespace-nowrap">{DATE_LABEL(m.bankDate)}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-6 h-6 rounded-lg grid place-items-center shrink-0 ${isIn ? 'bg-success/15 text-success' : 'bg-danger/12 text-danger'}`}>
            {isIn ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="text-ink truncate">{m.typeLabel}</div>
            <div className="text-slate text-[11px] truncate">
              {m.contractNumber ? <span className="tabular-nums">{m.contractNumber}</span> : null}
              {m.contractNumber && m.tenantName ? ' · ' : null}
              {m.tenantName ?? (m.contractNumber ? null : '—')}
              {otroPeriodo && (
                <span
                  title={`La plata se movió en este mes, pero el pago corresponde a ${periodLabel(m.periodo)}.`}
                  className="ml-1.5 px-1.5 py-px rounded bg-info/15 text-info font-medium whitespace-nowrap"
                >
                  corresponde a {periodLabel(m.periodo)}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 text-slate-dark whitespace-nowrap">{m.bank ?? <span className="text-slate/40">—</span>}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap font-medium ${isIn ? 'text-success' : 'text-ink'}`}>{signed}</td>
      <td className="px-3 py-2.5 text-center">
        {m.conciliado ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/15 text-success text-[11px] font-medium"><CheckCircle2 size={12} /> OK</span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warn/15 text-warn text-[11px] font-medium"><Clock size={12} /> Pend.</span>
        )}
      </td>
    </tr>
  )
}
