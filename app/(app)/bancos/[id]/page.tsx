import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { getBankAccountDetail } from '@/lib/bank/queries'
import { listBanks } from '@/lib/entities/queries'
import { EditBankAccountForm } from '@/components/bank/EditBankAccountForm'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { OWNER_TYPE_LABEL } from '@/lib/owner'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BancoDetailPage({ params }: PageProps) {
  const { id } = await params
  const [account, banks] = await Promise.all([
    getBankAccountDetail(id),
    listBanks(),
  ])

  if (!account) notFound()

  return (
    <>
      <BreadcrumbTitle name={account.alias} />

      <div className="mb-6">
        <Link href="/bancos" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          ← Volver a bancos
        </Link>
      </div>

      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="label-cap text-slate">Cuenta bancaria</p>
          <h1 className="font-display text-[22px] font-medium text-ink mt-1">{account.alias}</h1>
          <p className="text-[13px] text-slate-dark mt-1">
            {account.bankName} · Titular: {account.ownerLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {account.isActive
            ? <Badge tone="success">Activa</Badge>
            : <Badge tone="neutral">Inactiva</Badge>}
          <Badge tone="neutral">{OWNER_TYPE_LABEL[account.ownerType]}</Badge>
        </div>
      </div>

      <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Editar cuenta</h2>
          <p className="text-[12px] text-slate mt-0.5">
            El titular no se cambia desde acá — para reasignar la cuenta a otro propietario, contactar al admin.
          </p>
        </div>
        <div className="p-5">
          <EditBankAccountForm account={account} banks={banks} />
        </div>
      </section>
    </>
  )
}
