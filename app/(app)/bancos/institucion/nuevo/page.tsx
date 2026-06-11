import Link from 'next/link'
import { EditBankInstitutionForm } from '@/components/bank/EditBankInstitutionForm'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'

export default function NewBankInstitutionPage() {
  return (
    <>
      <BreadcrumbTitle name="Nuevo banco" />

      <div className="mb-6">
        <Link href="/bancos?tab=instituciones" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          ← Volver a instituciones
        </Link>
      </div>

      <div className="mb-6">
        <p className="label-cap text-slate">Nueva institución bancaria</p>
        <h1 className="font-display text-[22px] font-medium text-ink mt-1">Agregar banco</h1>
        <p className="text-[13px] text-slate-dark mt-1">
          Cargá el nombre y, opcionalmente, comisiones y datos de contacto. Podés completarlos más tarde.
        </p>
      </div>

      <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Datos del banco</h2>
          <p className="text-[12px] text-slate mt-0.5">
            Solo el nombre es obligatorio. Cuando termines, el banco aparece en la lista maestra y en el selector de cuentas.
          </p>
        </div>
        <div className="p-5">
          <EditBankInstitutionForm />
        </div>
      </section>
    </>
  )
}
