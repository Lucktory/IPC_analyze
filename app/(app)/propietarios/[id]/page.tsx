import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { EditLandlordForm } from '@/components/landlord/EditLandlordForm'
import { getLandlordDetail } from '@/lib/landlord/queries'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { fmtMoney as fmt, fmtDate } from '@/lib/format'
import { NamesCell } from '@/components/shared/cells'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function LandlordDetailPage({ params }: PageProps) {
  const { id } = await params
  const full = await getLandlordDetail(id)
  if (!full) notFound()

  const { landlord, properties, contracts } = full

  const activeContracts = contracts.filter(c => c.status === 'active')
  const vacantProperties = properties.filter(p => p.isVacant)

  return (
    <>
      <BreadcrumbTitle name={landlord.name} />

      <div className="mb-6">
        <Link href="/propietarios" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          ← Volver a propietarios
        </Link>
      </div>

      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="label-cap text-slate">Propietario</p>
          <h1 className="font-display text-[22px] font-medium text-ink mt-1">{landlord.name}</h1>
          <p className="text-[13px] text-slate-dark mt-1">
            {properties.length} propiedad{properties.length === 1 ? '' : 'es'} ·{' '}
            {activeContracts.length} contrato{activeContracts.length === 1 ? '' : 's'} activo{activeContracts.length === 1 ? '' : 's'}
            {vacantProperties.length > 0 && (
              <> · <span className="text-danger">{vacantProperties.length} vacante{vacantProperties.length === 1 ? '' : 's'}</span></>
            )}
          </p>
        </div>
      </div>

      {/* Edit form */}
      <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Datos fiscales y de contacto</h2>
          <p className="text-[12px] text-slate mt-0.5">Editables — los cambios se guardan al confirmar</p>
        </div>
        <div className="p-5">
          <EditLandlordForm landlord={landlord} propertyCount={properties.length} contractCount={contracts.length} />
        </div>
      </section>

      {/* External accountant (read-only for now) */}
      {landlord.externalAccountant && (
        <section className="mt-6 bg-paper border border-line rounded shadow-card p-5">
          <p className="label-cap text-slate mb-1">Contador externo</p>
          <p className="text-[14px] text-ink">{landlord.externalAccountant.name}</p>
          {landlord.externalAccountant.firmName && (
            <p className="text-[12px] text-slate mt-0.5">{landlord.externalAccountant.firmName}</p>
          )}
        </section>
      )}

      {/* Properties */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Propiedades</h2>
          <p className="text-[12px] text-slate mt-0.5">
            {properties.length} en total · {properties.length - vacantProperties.length} ocupada{(properties.length - vacantProperties.length) === 1 ? '' : 's'}
          </p>
        </div>
        {properties.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[14px] text-slate">Sin propiedades registradas a este propietario</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Dirección</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Tipo</th>
                <th className="text-right px-5 py-2.5 label-cap font-medium">Titularidad</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Inquilinos</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p, idx) => (
                // Whole row clickable → jumps to the property edit page,
                // matching the pattern on /propiedades and /propietarios.
                <ClickableRow
                  key={p.id}
                  href={`/propiedades/${p.id}`}
                  title={`Abrir ficha de ${cleanAddress(p.address)}`}
                  className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} ${p.isVacant ? 'opacity-65' : ''} hover:bg-cream-2 transition-colors align-top`}
                >
                  <td className="px-5 py-3 text-ink font-medium">{cleanAddress(p.address)}</td>
                  <td className="px-5 py-3 text-slate-dark capitalize">{p.propertyType}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-dark">{p.ownershipPct.toFixed(0)}%</td>
                  <td className="px-5 py-3 text-slate-dark">
                    <NamesCell
                      noun={['inquilino', 'inquilinos']}
                      items={p.tenants.map(t => ({ id: t.id, name: t.name, pct: t.sharePct }))}
                    />
                  </td>
                  <td className="px-5 py-3">
                    {p.isVacant ? <Badge tone="danger">Vacante</Badge> : <Badge tone="success">Ocupada</Badge>}
                  </td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Contracts */}
      <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Contratos</h2>
          <p className="text-[12px] text-slate mt-0.5">
            {contracts.length} en total · {activeContracts.length} activo{activeContracts.length === 1 ? '' : 's'}
          </p>
        </div>
        {contracts.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[14px] text-slate">Sin contratos asociados</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Inquilino</th>
                <th className="text-right px-5 py-2.5 label-cap font-medium">Alquiler</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Cadencia</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Vencimiento</th>
                <th className="text-left  px-5 py-2.5 label-cap font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c, idx) => (
                <tr key={c.id} className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} ${c.status === 'rescinded' ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-3 text-ink font-medium">
                    <Link href={`/contratos/${c.id}`} className="hover:underline underline-offset-4 decoration-slate/40">
                      {c.tenantName}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-ink">{fmt(c.rent)}</td>
                  <td className="px-5 py-3 text-slate-dark capitalize">{c.cadence}</td>
                  <td className="px-5 py-3 text-slate-dark tabular-nums">{fmtDate(c.endDate)}</td>
                  <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

function cleanAddress(s: string) {
  return s.replace(/\s*\(vacante\)\s*$/i, '')
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':     return <Badge tone="success">Activo</Badge>
    case 'rescinded':  return <Badge tone="danger">Rescindido</Badge>
    case 'ended':      return <Badge tone="neutral">Finalizado</Badge>
    default:           return <Badge tone="neutral">{status}</Badge>
  }
}
