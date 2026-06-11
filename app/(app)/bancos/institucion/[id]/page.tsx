import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { getBankInstitution } from '@/lib/bank/queries'
import { EditBankInstitutionForm } from '@/components/bank/EditBankInstitutionForm'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BankInstitutionDetailPage({ params }: PageProps) {
  const { id } = await params
  const bank   = await getBankInstitution(id)
  if (!bank) notFound()

  return (
    <>
      <BreadcrumbTitle name={bank.name} />

      <div className="mb-6">
        <Link href="/bancos?tab=instituciones" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          ← Volver a instituciones
        </Link>
      </div>

      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="label-cap text-slate">Institución bancaria</p>
          <h1 className="font-display text-[22px] font-medium text-ink mt-1">{bank.name}</h1>
          <p className="text-[13px] text-slate-dark mt-1">
            {bank.accountCount === 0
              ? 'Sin cuentas registradas todavía.'
              : `${bank.accountCount} cuenta${bank.accountCount === 1 ? '' : 's'} usa${bank.accountCount === 1 ? '' : 'n'} este banco.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bank.shortCode && <Badge tone="neutral">{bank.shortCode}</Badge>}
          <Badge tone={bank.accountCount > 0 ? 'success' : 'neutral'}>
            {bank.accountCount > 0 ? 'En uso' : 'Sin cuentas'}
          </Badge>
        </div>
      </div>

      <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Editar institución</h2>
          <p className="text-[12px] text-slate mt-0.5">
            Comisiones y contactos cargados acá se usan para calcular liquidaciones y conciliaciones.
          </p>
        </div>
        <div className="p-5">
          <EditBankInstitutionForm bank={bank} accountCount={bank.accountCount} />
        </div>
      </section>
    </>
  )
}
