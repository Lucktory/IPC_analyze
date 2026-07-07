import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CreditCard, ShieldCheck, FileText, Building2, Coins, ChevronRight, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { EditLandlordForm } from '@/components/landlord/EditLandlordForm'
import { LandlordContactFields } from '@/components/landlord/LandlordContactFields'
import { getLandlordDetail, getLandlordPeriodStats } from '@/lib/landlord/queries'
import { getDashboardPeriod } from '@/lib/dashboard/queries'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { fmtMoney as fmt } from '@/lib/format'
import { periodLabel } from '@/lib/period'

const TAX: Record<string, { label: string; color: string; note: string }> = {
  RI:          { label: 'Responsable Inscripto', color: '#16A34A', note: 'Alta en IVA' },
  MONOTRIBUTO: { label: 'Monotributo',           color: '#F59E0B', note: 'Régimen simplificado' },
  CF:          { label: 'Consumidor Final',       color: '#8B5CF6', note: 'Sin condición cargada' },
  EXENTO:      { label: 'Exento',                 color: '#8A93A5', note: 'Exento de IVA' },
}
const cleanAddress = (s: string) => s.replace(/\s*\(vacante\)\s*$/i, '')

interface PageProps { params: Promise<{ id: string }> }

export default async function LandlordDetailPage({ params }: PageProps) {
  const { id } = await params
  const period = await getDashboardPeriod()
  const [full, stats] = await Promise.all([getLandlordDetail(id), getLandlordPeriodStats(id, period)])
  if (!full) notFound()

  const { landlord, properties, contracts } = full
  const activeContracts = contracts.filter(c => c.status === 'active')
  const ocupadas = properties.filter(p => !p.isVacant).length
  const vacantes = properties.length - ocupadas
  const tax = TAX[landlord.taxCategory] ?? TAX.CF
  const cobradoPct = stats.contratosActivos > 0 ? (stats.contratosCobrados / stats.contratosActivos) * 100 : 0

  const kpis = [
    { Icon: CreditCard, color: '#3B82F6', label: 'CUIT',            value: landlord.dniOrCuit ?? '—',          sub: 'Identificación fiscal' },
    { Icon: ShieldCheck, color: tax.color, label: 'Condición fiscal', value: tax.label,                          sub: tax.note },
    { Icon: FileText,   color: '#8B5CF6', label: 'Contratos activos', value: String(activeContracts.length),     sub: `${contracts.length} en total` },
    { Icon: Building2,  color: '#06B6D4', label: 'Propiedades',      value: String(properties.length),           sub: `${ocupadas} ocupadas · ${vacantes} vacantes` },
    { Icon: Coins,      color: '#F59E0B', label: 'Cobrado (mes)',    value: fmt(stats.cobrado),                  sub: periodLabel(period) },
  ]

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
      <BreadcrumbTitle name={landlord.name} />

      <header className="shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <nav className="text-[12px] text-slate flex items-center gap-1.5">
            <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
            <span className="text-slate/50">/</span>
            <Link href="/propietarios" className="hover:text-ink transition-colors">Propietarios</Link>
            <span className="text-slate/50">/</span>
            <span className="text-slate-dark truncate max-w-[240px]">{landlord.name}</span>
          </nav>
          <Link href="/propietarios" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[12px] text-ink hover:border-info/40 transition-colors">
            <ArrowLeft size={14} /> Volver
          </Link>
        </div>
        <h1 className="text-[22px] font-semibold text-ink tracking-tight mt-2">Propietario · {landlord.name}</h1>
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-line bg-paper p-3.5 flex flex-col gap-2.5">
            <span className="w-8 h-8 rounded-lg grid place-items-center" style={{ backgroundColor: k.color + '1f', color: k.color }}>
              <k.Icon size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-slate">{k.label}</p>
              <p className="text-[15px] font-semibold text-ink leading-tight tabular-nums truncate">{k.value}</p>
              <p className="text-[11px] text-slate mt-0.5 truncate">{k.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Body: 3 columns — each scrolls independently at lg so the page fits one screen */}
      <section className="flex flex-col lg:flex-row gap-4 lg:flex-1 lg:min-h-0">
        {/* Left column */}
        <div className="space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-auto lg:pr-1">
          <Card title="Datos de contacto">
            <LandlordContactFields
              landlordId={landlord.id}
              email={landlord.email}
              phone={landlord.phone}
              cuit={landlord.dniOrCuit}
              altEmails={landlord.altEmails}
              condicionLabel={tax.label}
            />
          </Card>

          <Card title="Propiedades" sub={`${properties.length} · ${ocupadas} ocupadas`}>
            {properties.length === 0 ? (
              <p className="text-[13px] text-slate py-2">Sin propiedades registradas</p>
            ) : (
              <ul className="divide-y divide-line -my-1">
                {properties.map(p => (
                  <li key={p.id}>
                    <Link href={`/propiedades/${p.id}`} className="py-2.5 flex items-center gap-2 hover:bg-cream-2 -mx-1 px-1 rounded transition-colors">
                      <Building2 size={14} className="text-slate shrink-0" />
                      <span className="text-[13px] text-ink truncate flex-1 min-w-0">{cleanAddress(p.address)}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cream-2 text-slate-dark capitalize shrink-0">{p.propertyType}</span>
                      {p.isVacant ? <Badge tone="danger">Vacante</Badge> : <Badge tone="success">Ocupada</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Center column — Contratos */}
        <div className="space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-auto lg:pr-1">
          <Card title="Contratos" sub={`${contracts.length} · ${activeContracts.length} activos`} flush>
            {contracts.length === 0 ? (
              <p className="text-[13px] text-slate px-4 pb-4">Sin contratos asociados</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-line">
                      {['N° Contrato', 'Inquilino', 'Propiedad', 'Alquiler', 'Estado', ''].map((h, i) => (
                        <th key={i} className={`label-cap font-medium text-slate px-4 py-2 ${h === 'Alquiler' ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map(c => (
                      <ClickableRow key={c.id} href={`/contratos/${c.id}`} className={`border-b border-line/50 last:border-0 hover:bg-cream-2 transition-colors ${c.status === 'rescinded' ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-2.5 tabular-nums text-ink whitespace-nowrap">{c.contractNumber ?? `#${c.id.slice(0, 8)}`}</td>
                        <td className="px-4 py-2.5 text-slate-dark truncate max-w-[130px]">{c.tenantName}</td>
                        <td className="px-4 py-2.5 text-slate truncate max-w-[150px]">{c.propertyAddress ? cleanAddress(c.propertyAddress) : '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ink whitespace-nowrap">{fmt(c.rent)}</td>
                        <td className="px-4 py-2.5"><ContractBadge status={c.status} endDate={c.endDate} /></td>
                        <td className="px-4 py-2.5 text-right"><ChevronRight size={15} className="text-slate/50 inline" /></td>
                      </ClickableRow>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right column — Resumen + Notas */}
        <div className="space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-auto lg:pr-1">
          <Card title="Resumen" sub={periodLabel(period)}>
            <dl className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between"><dt className="text-slate">Cobrado</dt><dd className="tabular-nums text-ink">{fmt(stats.cobrado)}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-slate">Comisión</dt><dd className="tabular-nums text-slate-dark">− {fmt(stats.comision)}</dd></div>
              <div className="flex items-center justify-between border-t border-line pt-2"><dt className="text-ink font-medium">Transferencia</dt><dd className="tabular-nums text-success font-medium">{fmt(stats.transferencia)}</dd></div>
            </dl>
            <div className="mt-3 pt-3 border-t border-line">
              <div className="flex items-center justify-between text-[12px] mb-1.5">
                <span className="text-slate">Contratos cobrados</span>
                <span className="tabular-nums text-ink">{stats.contratosCobrados} / {stats.contratosActivos}</span>
              </div>
              <div className="h-2 rounded-full bg-cream-2 overflow-hidden">
                <div className="h-full rounded-full bg-info" style={{ width: `${cobradoPct}%` }} />
              </div>
            </div>
          </Card>

          {landlord.externalAccountant && (
            <Card title="Contador externo">
              <p className="text-[13px] text-ink">{landlord.externalAccountant.name}</p>
              {landlord.externalAccountant.firmName && <p className="text-[12px] text-slate mt-0.5">{landlord.externalAccountant.firmName}</p>}
            </Card>
          )}

          <Card title="Notas">
            <p className="text-[13px] text-slate-dark whitespace-pre-wrap leading-relaxed">{landlord.notes?.trim() || 'Sin notas'}</p>
          </Card>

          {/* Edit (collapsible) — preserves the fiscal/contact edit form */}
          <details className="bg-paper border border-line rounded-xl shadow-card">
            <summary className="list-none px-4 sm:px-5 py-3.5 flex items-center gap-2 cursor-pointer text-[14px] font-medium text-ink [&::-webkit-details-marker]:hidden">
              <Pencil size={15} className="text-slate" /> Editar datos
            </summary>
            <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-line">
              <EditLandlordForm landlord={landlord} propertyCount={properties.length} contractCount={contracts.length} />
            </div>
          </details>
        </div>
      </section>
    </div>
  )
}

function Card({ title, sub, children, flush }: { title: string; sub?: string; children: React.ReactNode; flush?: boolean }) {
  return (
    <section className={`bg-paper border border-line rounded-xl shadow-card ${flush ? 'pt-4 pb-0' : 'p-4 sm:p-5'}`}>
      <header className={`mb-3 ${flush ? 'px-4 sm:px-5' : ''}`}>
        <h2 className="font-display text-[14px] font-medium text-ink leading-tight">{title}</h2>
        {sub && <p className="text-[12px] text-slate mt-0.5">{sub}</p>}
      </header>
      {children}
    </section>
  )
}

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-slate">{k}</dt>
      <dd className={`text-ink mt-0.5 break-words ${mono ? 'tabular-nums' : ''}`}>{v}</dd>
    </div>
  )
}

function ContractBadge({ status, endDate }: { status: string; endDate: string }) {
  if (status === 'rescinded') return <Badge tone="danger">Rescindido</Badge>
  if (status === 'ended')     return <Badge tone="neutral">Finalizado</Badge>
  if (status === 'draft')     return <Badge tone="neutral">Borrador</Badge>
  if (status === 'suspended') return <Badge tone="warn">Suspendido</Badge>
  const end = new Date(endDate).getTime(), now = Date.now()
  if (end < now) return <Badge tone="danger">Vencido</Badge>
  if (end - now <= 60 * 86400000) return <Badge tone="warn">Por vencer</Badge>
  return <Badge tone="success">Activo</Badge>
}
