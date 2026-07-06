import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Home, ShieldCheck, DollarSign, DoorOpen, Ruler, MapPin, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { getPropertyDetail } from '@/lib/property/queries'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { fmtMoney as fmt, fmtDate } from '@/lib/format'

const TYPE: Record<string, { label: string; color: string }> = {
  vivienda: { label: 'Vivienda', color: '#3B82F6' },
  local:    { label: 'Local',    color: '#8B5CF6' },
  cochera:  { label: 'Cochera',  color: '#F59E0B' },
  oficina:  { label: 'Oficina',  color: '#06B6D4' },
  deposito: { label: 'Depósito', color: '#8A93A5' },
}
const AVATAR_COLORS = ['#3B82F6', '#16A34A', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899']
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const colorFor = (s: string) => AVATAR_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]
const cleanAddress = (s: string) => s.replace(/\s*\(vacante\)\s*$/i, '')
const CAD = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

interface PageProps { params: Promise<{ id: string }> }

export default async function PropertyDetailPage({ params }: PageProps) {
  const { id } = await params
  const prop = await getPropertyDetail(id)
  if (!prop) notFound()

  const active   = prop.contracts.find(c => c.status === 'active') ?? null
  const isVacant  = !active || /\(vacante\)/i.test(prop.address)
  const t         = TYPE[prop.propertyType] ?? { label: prop.propertyType, color: '#8A93A5' }
  const fullAddr  = `${cleanAddress(prop.address)}${prop.unit ? ` ${prop.unit}` : ''}`
  const mapsUrl   = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${fullAddr}, ${prop.city ?? ''} ${prop.province ?? ''}`)}`
  // Contract history newest-first
  const history = prop.contracts.slice().sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))

  const kpis = [
    { Icon: Home,       color: t.color,   label: 'Tipo',            value: t.label },
    { Icon: ShieldCheck, color: isVacant ? '#F59E0B' : '#16A34A', label: 'Estado', badge: isVacant ? 'vacante' : 'ocupada' },
    { Icon: DollarSign, color: '#16A34A', label: 'Alquiler vigente', value: active ? fmt(active.currentRent) : '—' },
    { Icon: DoorOpen,   color: '#8B5CF6', label: 'Ambientes',       value: prop.rooms != null ? String(prop.rooms) : 's/d' },
    { Icon: Ruler,      color: '#06B6D4', label: 'Superficie',      value: prop.surfaceM2 != null ? `${prop.surfaceM2} m²` : 's/d' },
    { Icon: MapPin,     color: '#EC4899', label: 'Localidad',       value: prop.city ?? '—' },
  ]

  return (
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
      <BreadcrumbTitle name={fullAddr} />

      <header className="shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <nav className="text-[12px] text-slate flex items-center gap-1.5">
            <Link href="/dashboard" className="hover:text-ink transition-colors">Inicio</Link>
            <span className="text-slate/50">/</span>
            <Link href="/propiedades" className="hover:text-ink transition-colors">Propiedades</Link>
            <span className="text-slate/50">/</span>
            <span className="text-slate-dark truncate max-w-[240px]">{fullAddr}</span>
          </nav>
          <Link href="/propiedades" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[12px] text-ink hover:border-info/40 transition-colors">
            <ArrowLeft size={14} /> Volver
          </Link>
        </div>
        <h1 className="text-[22px] font-semibold text-ink tracking-tight mt-2">Propiedad · {fullAddr}</h1>
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-line bg-paper p-3.5 flex flex-col gap-2.5">
            <span className="w-8 h-8 rounded-lg grid place-items-center" style={{ backgroundColor: k.color + '1f', color: k.color }}>
              <k.Icon size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-slate">{k.label}</p>
              {k.badge
                ? <div className="mt-0.5">{k.badge === 'ocupada'
                    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/15 text-success">Ocupada</span>
                    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-warn/15 text-warn">Vacante</span>}</div>
                : <p className="text-[15px] font-semibold text-ink leading-tight tabular-nums truncate">{k.value}</p>}
            </div>
          </div>
        ))}
      </section>

      {/* Body: 3 columns */}
      <section className="flex flex-col lg:flex-row gap-4 lg:flex-1 lg:min-h-0">
        {/* Left */}
        <div className="space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-auto lg:pr-1">
          <Card title="Datos">
            <dl className="space-y-2.5 text-[12px]">
              <Field k="Dirección" v={cleanAddress(prop.address)} />
              <Field k="Unidad" v={prop.unit ?? '—'} />
              <Field k="Localidad" v={prop.city ?? '—'} />
              <Field k="Provincia" v={prop.province ?? '—'} />
              <Field k="Tipo" v={t.label} />
              <Field k="Ambientes" v={prop.rooms != null ? String(prop.rooms) : 's/d'} />
              <Field k="Superficie" v={prop.surfaceM2 != null ? `${prop.surfaceM2} m²` : 's/d'} />
            </dl>
          </Card>

          <Card title="Propietario(s)">
            {prop.landlords.length === 0 ? (
              <p className="text-[13px] text-slate py-1">Sin propietarios cargados</p>
            ) : (
              <>
                <ul className="divide-y divide-line -my-1">
                  {prop.landlords.map(l => {
                    const col = colorFor(l.name)
                    return (
                      <li key={l.id} className="py-2.5 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-semibold shrink-0" style={{ backgroundColor: col + '22', color: col }}>{initials(l.name)}</span>
                        <div className="min-w-0 flex-1">
                          <Link href={`/propietarios/${l.id}`} className="text-[13px] text-ink truncate block hover:underline underline-offset-2">{l.name}</Link>
                          {l.cuit && <p className="text-[11px] text-slate tabular-nums">CUIT {l.cuit}</p>}
                        </div>
                        <span className="text-[12px] font-medium text-info tabular-nums shrink-0">{l.ownershipPct.toFixed(0)}%</span>
                      </li>
                    )
                  })}
                </ul>
                <div className="pt-2.5 mt-1 border-t border-line flex items-center justify-between text-[12px]">
                  <span className="text-slate">Total</span>
                  <span className="tabular-nums text-ink font-medium">{prop.landlords.reduce((s, l) => s + l.ownershipPct, 0).toFixed(0)}%</span>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Center */}
        <div className="space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-auto lg:pr-1">
          <Card title="Contrato actual" topRight={active ? <Badge tone="success">Activo</Badge> : <Badge tone="warn">Vacante</Badge>}>
            {active ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px]">
                <Field k="Inquilino" v={active.primaryTenant ?? '—'} />
                <Field k="Alquiler" v={fmt(active.currentRent)} mono />
                <Field k="Cadencia" v={CAD(active.cadence)} />
                <Field k="Día de pago" v={active.paymentDay != null ? `${active.paymentDay} de cada mes` : '—'} />
                <Field k="Vigencia" v={active.startDate && active.endDate ? `${fmtDate(active.startDate)} — ${fmtDate(active.endDate)}` : '—'} mono />
                <div><dt className="text-slate">Contrato</dt><dd className="mt-0.5"><Link href={`/contratos/${active.id}`} className="text-info hover:underline text-[12px]">Ver ficha →</Link></dd></div>
              </dl>
            ) : (
              <p className="text-[13px] text-slate py-2">Propiedad sin contrato activo</p>
            )}
          </Card>

          <Card title="Historial de contratos" sub={`${prop.contracts.length} en total`} flush>
            {prop.contracts.length === 0 ? (
              <p className="text-[13px] text-slate px-4 pb-4">Sin contratos registrados</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-line">
                      {['Inquilino', 'Período', 'Estado', ''].map((h, i) => (
                        <th key={i} className="label-cap font-medium text-slate px-4 py-2 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(c => (
                      <ClickableRow key={c.id} href={`/contratos/${c.id}`} className="border-b border-line/50 last:border-0 hover:bg-cream-2 transition-colors">
                        <td className="px-4 py-2.5 text-ink truncate max-w-[150px]">{c.primaryTenant ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-dark tabular-nums whitespace-nowrap">{c.startDate && c.endDate ? `${fmtDate(c.startDate)} — ${fmtDate(c.endDate)}` : '—'}</td>
                        <td className="px-4 py-2.5"><ContractStatusBadge status={c.status} /></td>
                        <td className="px-4 py-2.5 text-right text-slate/50">›</td>
                      </ClickableRow>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right */}
        <div className="space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-auto lg:pr-1">
          <Card title="Notas">
            <p className="text-[13px] text-slate-dark whitespace-pre-wrap leading-relaxed">{prop.notes?.trim() || 'Sin notas'}</p>
          </Card>

          <Card title="Ubicación">
            <div className="rounded-lg border border-line bg-cream-2 h-28 grid place-items-center">
              <MapPin size={28} className="text-slate/50" />
            </div>
            <p className="text-[13px] text-ink mt-3">{fullAddr}</p>
            <p className="text-[12px] text-slate">{[prop.city, prop.province].filter(Boolean).join(', ')}</p>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-info hover:underline">
              Ver en Google Maps <ExternalLink size={13} />
            </a>
          </Card>
        </div>
      </section>
    </div>
  )
}

function Card({ title, sub, topRight, children, flush }: { title: string; sub?: string; topRight?: React.ReactNode; children: React.ReactNode; flush?: boolean }) {
  return (
    <section className={`bg-paper border border-line rounded-xl shadow-card ${flush ? 'pt-4 pb-0' : 'p-4 sm:p-5'}`}>
      <header className={`mb-3 flex items-start justify-between gap-2 ${flush ? 'px-4 sm:px-5' : ''}`}>
        <div>
          <h2 className="font-display text-[14px] font-medium text-ink leading-tight">{title}</h2>
          {sub && <p className="text-[12px] text-slate mt-0.5">{sub}</p>}
        </div>
        {topRight}
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

function ContractStatusBadge({ status }: { status: string }) {
  if (status === 'rescinded') return <Badge tone="danger">Rescindido</Badge>
  if (status === 'ended')     return <Badge tone="neutral">Finalizado</Badge>
  if (status === 'active')    return <Badge tone="success">Activo</Badge>
  if (status === 'draft')     return <Badge tone="neutral">Borrador</Badge>
  if (status === 'suspended') return <Badge tone="warn">Suspendido</Badge>
  return <Badge tone="neutral">{status}</Badge>
}
