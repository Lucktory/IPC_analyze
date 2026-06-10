import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { getPropertyDetail } from '@/lib/property/queries'
import { EditPropertyForm } from '@/components/property/EditPropertyForm'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

const TYPE_LABEL: Record<string, string> = {
  vivienda: 'Vivienda',
  local:    'Local',
  cochera:  'Cochera',
  oficina:  'Oficina',
  deposito: 'Depósito',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { id } = await params
  const property = await getPropertyDetail(id)
  if (!property) notFound()

  const activeContracts = property.contracts.filter(c => c.status === 'active')

  // Strip "(vacante)" placeholder from the display name (a leftover from import)
  const displayAddress = property.address.replace(/\s*\(vacante\)\s*$/i, '')

  return (
    <>
      <BreadcrumbTitle name={displayAddress} />

      <div className="mb-6">
        <Link href="/propiedades" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          ← Volver a propiedades
        </Link>
      </div>

      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="label-cap text-slate">Propiedad</p>
          <h1 className="font-display text-[22px] font-medium text-ink mt-1">{displayAddress}</h1>
          <p className="text-[13px] text-slate-dark mt-1">
            {TYPE_LABEL[property.propertyType] ?? property.propertyType} ·{' '}
            {property.landlords.length} propietario{property.landlords.length === 1 ? '' : 's'} ·{' '}
            {activeContracts.length} contrato{activeContracts.length === 1 ? '' : 's'} activo{activeContracts.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Datos de la propiedad</h2>
          <p className="text-[12px] text-slate mt-0.5">
            Solo dirección y tipo se editan desde acá. Para reasignar propietarios, contactar al admin.
          </p>
        </div>
        <div className="p-5">
          <EditPropertyForm property={property} contractCount={property.contracts.length} />
        </div>
      </section>

      {property.landlords.length > 0 && (
        <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-display text-[15px] font-medium text-ink">Propietarios</h2>
          </div>
          <ul className="divide-y divide-line/30">
            {property.landlords.map(l => (
              <li key={l.id} className="px-5 py-3 flex items-center justify-between">
                <Link href={`/propietarios/${l.id}`} className="text-[13px] text-ink hover:underline decoration-slate/40">
                  {l.name}
                </Link>
                <span className="text-[12px] text-slate tabular-nums">{l.ownershipPct.toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {property.contracts.length > 0 && (
        <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-display text-[15px] font-medium text-ink">Contratos</h2>
            <p className="text-[12px] text-slate mt-0.5">
              Todos los contratos sobre esta propiedad (activos y pasados).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <th className="text-left px-4 py-1.5 label-cap font-medium border-r border-line/50">Inquilino</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Alquiler</th>
                  <th className="text-left px-4 py-1.5 label-cap font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {property.contracts.map((c, idx) => (
                  <tr key={c.id} className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} hover:bg-cream-2 transition-colors border-b border-line/30`}>
                    <td className="px-4 py-1.5 text-ink font-medium border-r border-line/30">
                      <Link href={`/contratos/${c.id}`} className="hover:underline underline-offset-4 decoration-slate/40">
                        {c.primaryTenant ?? '(sin inquilino)'}
                      </Link>
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-ink border-r border-line/30">{fmt(c.currentRent)}</td>
                    <td className="px-4 py-1.5">
                      {c.status === 'active'    ? <Badge tone="success">Activo</Badge> :
                       c.status === 'rescinded' ? <Badge tone="danger">Rescindido</Badge> :
                       <Badge tone="neutral">{c.status}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
