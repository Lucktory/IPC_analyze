import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { getTenantDetail } from '@/lib/tenant/queries'
import { EditTenantForm } from '@/components/tenant/EditTenantForm'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { fmtMoney as fmt } from '@/lib/format'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InquilinoDetailPage({ params }: PageProps) {
  const { id } = await params
  const tenant = await getTenantDetail(id)
  if (!tenant) notFound()

  const activeContracts = tenant.contracts.filter(c => c.status === 'active')

  return (
    <>
      <BreadcrumbTitle name={tenant.name} />

      <div className="mb-6">
        <Link href="/inquilinos" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          ← Volver a inquilinos
        </Link>
      </div>

      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="label-cap text-slate">Inquilino</p>
          <h1 className="font-display text-[22px] font-medium text-ink mt-1">{tenant.name}</h1>
          <p className="text-[13px] text-slate-dark mt-1">
            {activeContracts.length} contrato{activeContracts.length === 1 ? '' : 's'} activo{activeContracts.length === 1 ? '' : 's'}
            {tenant.contractCount !== activeContracts.length && ` · ${tenant.contractCount} total`}
          </p>
        </div>
      </div>

      <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Datos del inquilino</h2>
          <p className="text-[12px] text-slate mt-0.5">
            Los cambios se reflejan inmediatamente en la liquidación y conciliación.
          </p>
        </div>
        <div className="p-5">
          <EditTenantForm tenant={tenant} />
        </div>
      </section>

      {tenant.contracts.length > 0 && (
        <section className="mt-6 bg-paper border border-line rounded shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-display text-[15px] font-medium text-ink">Contratos</h2>
            <p className="text-[12px] text-slate mt-0.5">
              Todos los contratos donde figura como inquilino.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead className="bg-cream-2/60">
                <tr className="border-b border-line">
                  <th className="text-left px-4 py-1.5 label-cap font-medium border-r border-line/50">Propietario</th>
                  <th className="text-right px-4 py-1.5 label-cap font-medium border-r border-line/50">Alquiler</th>
                  <th className="text-left px-4 py-1.5 label-cap font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {tenant.contracts.map((c, idx) => (
                  <tr key={c.id} className={`${idx % 2 === 0 ? 'bg-cream/40' : ''} hover:bg-cream-2 transition-colors border-b border-line/30`}>
                    <td className="px-4 py-1.5 text-ink font-medium border-r border-line/30">
                      <Link href={`/contratos/${c.id}`} className="hover:underline underline-offset-4 decoration-slate/40">
                        {c.primaryLandlord ?? '(sin propietario)'}
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
