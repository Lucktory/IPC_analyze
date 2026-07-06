// ============================================================================
// /pendientes — action queue (2026-07 redesign). Four sections derived from the
// contract audit signals (listContracts): contracts por vencer, alquileres sin
// cobrar, ajustes de alquiler pendientes, and contratos sin nota. Every row
// links to /contratos/[id], where the actual action (renovar / rescindir /
// registrar pago / aplicar aumento / agregar nota) is performed.
// ============================================================================

import Link from 'next/link'
import { CalendarClock, Wallet, FileText, TrendingUp, ChevronRight } from 'lucide-react'
import { listContracts, type ContractRow } from '@/lib/entities/queries'
import { getDashboardPeriod } from '@/lib/dashboard/queries'
import { fmtMoney as fmt, fmtDate } from '@/lib/format'
import { periodLabel } from '@/lib/period'

export const dynamic    = 'force-dynamic'
export const fetchCache = 'force-no-store'

const DAY = 86400000
const CAP = 5
const INDEXER: Record<string, string> = { IPC_GENERAL: 'IPC', ICL: 'ICL', CASA_PROPIA: 'Casa Propia', FIXED: 'Fijo' }
const propLine = (c: ContractRow) => c.propertyAddress
  ? `${c.propertyAddress.replace(/\s*\(vacante\)\s*$/i, '')}${c.propertyCity ? `, ${c.propertyCity}` : ''}`
  : '—'

export default async function PendientesPage() {
  const period = await getDashboardPeriod()
  const { rows } = await listContracts({ period })

  const now       = Date.now()
  const [py, pm]  = period.split('-').map(Number)
  const active    = rows.filter(c => c.status === 'active')
  const inForce   = active.filter(c => new Date(c.endDate).getTime() >= now)
  const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - now) / DAY)

  // 1) Contratos por vencer — endDate within 60 days
  const porVencer = inForce
    .filter(c => daysUntil(c.endDate) <= 60)
    .sort((a, b) => a.endDate.localeCompare(b.endDate))

  // 2) Alquileres sin cobrar — no RENT_IN this period, with monto + atraso
  const dueDate = new Date(py, pm - 1, 1).getTime()
  const sinCobrar = inForce
    .filter(c => !c.hasRentThisMonth)
    .map(c => {
      const due = new Date(py, pm - 1, c.paymentDay).getTime()
      return { c, monto: c.currentRent, atraso: Math.max(0, Math.floor((now - due) / DAY)) }
    })
    .sort((a, b) => b.atraso - a.atraso)

  // 3) Ajustes de alquiler pendientes — next adjustment within 60 days
  const ajustes = inForce
    .filter(c => c.nextAdjustment && daysUntil(c.nextAdjustment) <= 60)
    .sort((a, b) => (a.nextAdjustment ?? '').localeCompare(b.nextAdjustment ?? ''))

  // 4) Pendientes sin nota — no note recorded this period
  const sinNota = inForce
    .filter(c => !c.hasNoteThisMonth)
    .sort((a, b) => (a.noteUpdatedAt ?? '').localeCompare(b.noteUpdatedAt ?? ''))

  const venceEn7      = porVencer.filter(c => daysUntil(c.endDate) <= 7).length
  const saldoSinCobro = sinCobrar.reduce((s, x) => s + x.monto, 0)

  const kpis = [
    { Icon: CalendarClock, color: '#F59E0B', label: 'Renovaciones',        value: porVencer.length, sub: `${venceEn7} vencen en los próximos 7 días` },
    { Icon: Wallet,        color: '#EF4444', label: 'Sin pago',            value: sinCobrar.length, sub: `Saldo comprometido: ${fmt(saldoSinCobro)}` },
    { Icon: FileText,      color: '#8A93A5', label: 'Sin nota',            value: sinNota.length,   sub: 'Casos sin seguimiento registrado' },
    { Icon: TrendingUp,    color: '#8B5CF6', label: 'Aumentos por aplicar', value: ajustes.length,  sub: `índice pendiente en ${ajustes.length} contratos` },
  ]

  return (
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
      <header className="shrink-0">
        <h1 className="text-[24px] font-semibold text-ink tracking-tight">Pendientes</h1>
        <nav className="text-[12px] text-slate mt-1 flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
          <span className="text-slate/50">/</span>
          <span className="text-slate-dark">Pendientes</span>
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-info/10 text-info text-[11px] font-medium">Período: {periodLabel(period)}</span>
        </nav>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-line bg-paper p-4 flex items-center gap-3">
            <span className="w-11 h-11 rounded-lg grid place-items-center shrink-0" style={{ backgroundColor: k.color + '1f', color: k.color }}>
              <k.Icon size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] text-slate">{k.label}</p>
              <p className="text-[22px] font-semibold text-ink leading-none tabular-nums">{k.value}</p>
              <p className="text-[11px] text-slate mt-1 truncate">{k.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Sections */}
      <div className="lg:flex-1 lg:min-h-0 lg:overflow-auto space-y-4 pr-0.5">
        <Section title="Contratos por vencer" count={porVencer.length} accent="#F59E0B"
          head={['Contrato', 'Inquilino', 'Propiedad', 'Vence', 'Acciones']}>
          {porVencer.slice(0, CAP).map(c => {
            const d = daysUntil(c.endDate)
            return (
              <Row key={c.id} id={c.id}
                cells={[
                  <IdCell key="a" c={c} />,
                  c.primaryTenant,
                  propLine(c),
                  <span key="v" className="text-warn">{d <= 0 ? 'Vencido' : `Vence en ${d} día${d === 1 ? '' : 's'}`}</span>,
                ]}
                actions={<>
                  <ActBtn href={`/contratos/${c.id}`} primary>Renovar</ActBtn>
                  <ActBtn href={`/contratos/${c.id}`}>Rescindir</ActBtn>
                </>}
              />
            )
          })}
        </Section>

        <Section title="Alquileres sin cobrar" count={sinCobrar.length} accent="#EF4444"
          head={['Contrato', 'Inquilino', 'Propiedad', 'Monto adeudado', 'Atraso', 'Acción']}>
          {sinCobrar.slice(0, CAP).map(({ c, monto, atraso }) => (
            <Row key={c.id} id={c.id}
              cells={[
                <IdCell key="a" c={c} />,
                c.primaryTenant,
                propLine(c),
                <span key="m" className="text-danger tabular-nums">{fmt(monto)}</span>,
                <span key="t" className="text-danger tabular-nums">{atraso > 0 ? `Atraso: ${atraso} días` : 'Al vencimiento'}</span>,
              ]}
              actions={<ActBtn href={`/contratos/${c.id}`} primary>Registrar pago</ActBtn>}
            />
          ))}
        </Section>

        <Section title="Ajustes de alquiler pendientes" count={ajustes.length} accent="#8B5CF6"
          head={['Contrato', 'Parte', 'Propiedad', 'Índice / Regla', 'Aplicar desde', 'Acción']}>
          {ajustes.slice(0, CAP).map(c => (
            <Row key={c.id} id={c.id}
              cells={[
                <IdCell key="a" c={c} />,
                c.primaryTenant,
                propLine(c),
                <span key="i" className="text-slate-dark">{INDEXER[c.indexer] ?? c.indexer} · {periodLabel(period)}</span>,
                <span key="d" className="tabular-nums text-slate-dark">{c.nextAdjustment ? fmtDate(c.nextAdjustment) : '—'}</span>,
              ]}
              actions={<ActBtn href={`/contratos/${c.id}`} primary>Aplicar aumento</ActBtn>}
            />
          ))}
        </Section>

        <Section title="Pendientes sin nota" count={sinNota.length} accent="#8A93A5"
          head={['Contrato', 'Persona', 'Propiedad', 'Última actualización', 'Acción']}>
          {sinNota.slice(0, CAP).map(c => (
            <Row key={c.id} id={c.id}
              cells={[
                <IdCell key="a" c={c} />,
                c.primaryTenant,
                propLine(c),
                <span key="u" className="tabular-nums text-slate-dark">{c.noteUpdatedAt ? fmtDate(c.noteUpdatedAt) : '—'}</span>,
              ]}
              actions={<ActBtn href={`/contratos/${c.id}`} primary>Agregar nota</ActBtn>}
            />
          ))}
        </Section>
      </div>
    </div>
  )
}

function Section({ title, count, accent, head, children }: {
  title: string; count: number; accent: string; head: string[]; children: React.ReactNode
}) {
  return (
    <section className="bg-paper border border-line rounded-xl shadow-card overflow-hidden">
      <div className="border-l-[3px] pl-4 pr-4 py-2.5 flex items-center justify-between border-b border-line" style={{ borderLeftColor: accent }}>
        <h2 className="font-display text-[15px] font-medium text-ink flex items-center gap-2">
          {title}
          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-cream-2 text-slate-dark text-[11px] tabular-nums">{count}</span>
        </h2>
        {count > CAP && <span className="text-[11px] text-slate">Mostrando {CAP} de {count}</span>}
      </div>
      {count === 0 ? (
        <p className="px-4 py-4 text-[13px] text-slate">Nada pendiente en esta categoría ✓</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[820px]">
            <thead>
              <tr className="border-b border-line">
                {head.map((h, i) => (
                  <th key={i} className={`label-cap font-medium text-slate px-4 py-2 ${i === head.length - 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Row({ id, cells, actions }: { id: string; cells: React.ReactNode[]; actions: React.ReactNode }) {
  return (
    <tr className="border-b border-line/50 last:border-0 hover:bg-cream-2 transition-colors">
      {cells.map((c, i) => (
        <td key={i} className="px-4 py-2.5 text-ink align-middle">{c}</td>
      ))}
      <td className="px-4 py-2.5 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1.5">
          {actions}
          <Link href={`/contratos/${id}`} className="text-slate/50 hover:text-ink transition-colors"><ChevronRight size={16} /></Link>
        </div>
      </td>
    </tr>
  )
}

function IdCell({ c }: { c: ContractRow }) {
  return <Link href={`/contratos/${c.id}`} className="tabular-nums text-ink hover:underline underline-offset-2">{c.contractNumber ?? `#${c.id.slice(0, 8)}`}</Link>
}

function ActBtn({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
      primary ? 'border border-info/40 text-info hover:bg-info/10' : 'border border-line text-slate-dark hover:bg-cream-2'
    }`}>{children}</Link>
  )
}
