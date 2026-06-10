import Link from 'next/link'
import { listPlantillaRows, listPlantillaPeriods, type PlantillaRow } from '@/lib/plantilla/queries'

// One row per contract per period. Mirrors the columns Alejandro's team
// already works with in Excel so the demo to "las chicas" feels like home.

const DEFAULT_PERIOD = '2026-05-01'

const fmt = (n: number) => {
  if (n === 0) return ''
  return '$ ' + Math.round(n).toLocaleString('es-AR')
}

const fmtDay = (s: string | null) => {
  if (!s) return ''
  return new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

const PERIOD_LABEL = (s: string) => {
  const [y, m] = s.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${months[+m - 1]} ${y}`
}

interface PageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function PlantillaPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const period = sp.period ?? DEFAULT_PERIOD

  const [rows, periods] = await Promise.all([
    listPlantillaRows(period),
    listPlantillaPeriods(),
  ])

  const totals = rows.reduce(
    (acc, r) => {
      acc.ingresos       += r.ingresos
      acc.transferencia  += r.transferencia
      acc.otrosDeduc     += r.otrosDeduc
      acc.admi           += r.admi
      acc.admGalicia     += r.admGalicia
      acc.admFrances50_9 += r.admFrances50_9
      acc.admFrances51_6 += r.admFrances51_6
      return acc
    },
    { ingresos: 0, transferencia: 0, otrosDeduc: 0, admi: 0, admGalicia: 0, admFrances50_9: 0, admFrances51_6: 0 },
  )

  return (
    <>
      {/* Header — title + period selector + jump-to-dashboard buttons */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 bg-cream/95 backdrop-blur-sm border-b border-line/60">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <p className="text-[13px] text-slate-dark">
            <strong className="text-ink font-medium">Plantilla</strong> · {PERIOD_LABEL(period)} · {rows.length} contratos
          </p>
          <p className="label-cap text-slate hidden sm:block">Vista mensual al estilo Excel</p>
        </div>

        {/* Period quick switcher (the "tabs" in Alejandro's workbook) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          <span className="label-cap text-slate mr-1 shrink-0">Período</span>
          {periods.map(p => (
            <Link
              key={p}
              href={`/plantilla?period=${p}`}
              className={[
                'inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors shrink-0',
                p === period
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-cream-2 text-slate-dark border-line hover:bg-cream hover:border-slate/30',
              ].join(' ')}
            >
              {PERIOD_LABEL(p)}
            </Link>
          ))}
        </div>

        {/* Jump-to-other-views buttons (what Alejandro asked for in his note) */}
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
          <span className="label-cap text-slate mr-1 shrink-0">Ir a</span>
          <JumpButton href="/dashboard"    label="Dashboard" />
          <JumpButton href="/contratos"    label="Contratos" />
          <JumpButton href="/propietarios" label="Propietarios" />
          <JumpButton href="/movimientos"  label="Movimientos" />
          <JumpButton href="/conciliacion" label="Conciliación" />
        </div>
      </div>

      {/* The sheet itself — wide table, vertical separators, ledger feel */}
      <section className="mt-4 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          {rows.length > 0 ? (
            <table className="w-full text-[11.5px] min-w-[2400px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <Th>OBSERVACION</Th>
                  <Th>L/F/A</Th>
                  <Th>FECHA INGRESO POR BANCO</Th>
                  <Th>PROPIETARIOS</Th>
                  <Th align="center">EXP.</Th>
                  <Th>INQUILINOS</Th>
                  <Th>AUMENTOS</Th>
                  <Th align="right">%</Th>
                  <Th>CONTRATO</Th>
                  <Th>DEUDA Y/U OBSERVACIONES</Th>
                  <Th>PERIODO</Th>
                  <Th align="right">INGRESOS</Th>
                  <Th align="right">TRANSFERENCIA</Th>
                  <Th align="right">OTROS DEDUC Y/O INGRESOS</Th>
                  <Th>Día transf.</Th>
                  <Th align="center">E</Th>
                  <Th align="right">ADMI</Th>
                  <Th align="right">ADM GALICIA</Th>
                  <Th align="right">ADM BCO FRANCES 50/9</Th>
                  <Th align="right">ADM FLAVIO BCO FRANCES 51/6</Th>
                  <Th>Mails</Th>
                  <Th align="center" last>Liqui</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => <Row key={r.contractId} r={r} odd={idx % 2 === 0} />)}

                {/* TOTAL row at the bottom — sums for the period */}
                <tr className="border-t-2 border-ink bg-cream-2">
                  <td colSpan={11} className="px-2 py-1.5 font-medium text-ink border-r border-line/40">TOTAL {PERIOD_LABEL(period).toUpperCase()}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-display font-medium text-ink border-r border-line/40">{fmt(totals.ingresos)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-display font-medium text-ink border-r border-line/40">{fmt(totals.transferencia)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-display font-medium text-ink border-r border-line/40">{fmt(totals.otrosDeduc)}</td>
                  <td className="px-2 py-1.5 border-r border-line/40"></td>
                  <td className="px-2 py-1.5 border-r border-line/40"></td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-display font-medium text-ink border-r border-line/40">{fmt(totals.admi)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-display font-medium text-ink border-r border-line/40">{fmt(totals.admGalicia)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-display font-medium text-ink border-r border-line/40">{fmt(totals.admFrances50_9)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-display font-medium text-ink border-r border-line/40">{fmt(totals.admFrances51_6)}</td>
                  <td className="px-2 py-1.5 border-r border-line/40"></td>
                  <td className="px-2 py-1.5"></td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center">
              <p className="text-[14px] text-slate">No hay contratos para {PERIOD_LABEL(period)}</p>
            </div>
          )}
        </div>
      </section>

      <p className="mt-3 text-[11px] text-slate">
        Tip: cada celda de DEUDA Y/U OBSERVACIONES se edita desde la página de detalle del contrato.
      </p>
    </>
  )
}

function JumpButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center px-2.5 py-1 rounded-full border border-line bg-paper text-slate-dark hover:bg-cream-2 hover:border-slate/30 text-[11px] font-medium transition-colors shrink-0"
    >
      {label}
    </Link>
  )
}

function Th({ children, align = 'left', last }: { children: React.ReactNode; align?: 'left' | 'right' | 'center'; last?: boolean }) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th className={`${alignClass} px-2 py-1.5 label-cap font-medium ${last ? '' : 'border-r border-line/40'} whitespace-nowrap`}>
      {children}
    </th>
  )
}

function Row({ r, odd }: { r: PlantillaRow; odd: boolean }) {
  const bg = odd ? 'bg-cream/40' : ''
  return (
    <tr className={`${bg} hover:bg-cream-2 transition-colors border-b border-line/30 align-top`}>
      <Td>{r.observacion ?? ''}</Td>
      <Td>{r.lfa ?? ''}</Td>
      <Td mono>{fmtDay(r.fechaIngresoBanco)}</Td>
      <Td>
        <Link href={`/contratos/${r.contractId}`} className="text-ink hover:underline decoration-slate/40">
          {r.propietarios}
        </Link>
      </Td>
      <Td align="center">{r.expensas ? <span className="text-ink">x</span> : ''}</Td>
      <Td>
        <div className="max-w-[220px] whitespace-normal leading-snug">{r.inquilinos}</div>
      </Td>
      <Td>{r.aumentos}</Td>
      <Td align="right" mono>{r.commissionPct > 0 ? `${Math.round(r.commissionPct)}%` : ''}</Td>
      <Td mono>{r.contrato}</Td>
      <Td>
        <div className="max-w-[260px] whitespace-pre-line leading-snug text-slate-dark">{r.deudaObs ?? ''}</div>
      </Td>
      <Td>{r.periodoLabel}</Td>
      <Td align="right" mono>{fmt(r.ingresos)}</Td>
      <Td align="right" mono className={r.transferencia > 0 ? 'text-success' : ''}>{fmt(r.transferencia)}</Td>
      <Td align="right" mono>{fmt(r.otrosDeduc)}</Td>
      <Td mono>{fmtDay(r.diaTransf)}</Td>
      <Td align="center">{r.e ?? ''}</Td>
      <Td align="right" mono className="font-medium">{fmt(r.admi)}</Td>
      <Td align="right" mono>{fmt(r.admGalicia)}</Td>
      <Td align="right" mono>{fmt(r.admFrances50_9)}</Td>
      <Td align="right" mono>{fmt(r.admFrances51_6)}</Td>
      <Td>
        <span className="text-slate-dark truncate inline-block max-w-[180px]">{r.mails ?? ''}</span>
      </Td>
      <Td align="center" last>{r.liqui ? <span className="text-success">✓</span> : ''}</Td>
    </tr>
  )
}

function Td({
  children, align = 'left', mono, last, className = '',
}: {
  children:   React.ReactNode
  align?:     'left' | 'right' | 'center'
  mono?:      boolean
  last?:      boolean
  className?: string
}) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  const monoClass  = mono ? 'tabular-nums' : ''
  const border     = last ? '' : 'border-r border-line/30'
  return (
    <td className={`${alignClass} ${monoClass} ${border} px-2 py-1.5 ${className}`}>
      {children}
    </td>
  )
}
