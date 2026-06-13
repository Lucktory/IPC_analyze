import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { EditTenantForm } from '@/components/tenant/EditTenantForm'

export default function NewTenantPage() {
  return (
    <>
      <BreadcrumbTitle name="Nuevo inquilino" />

      <div className="mb-6">
        <Link href="/inquilinos" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          ← Volver a inquilinos
        </Link>
      </div>

      <div className="mb-6">
        <p className="label-cap text-slate">Nuevo inquilino</p>
        <h1 className="font-display text-[22px] font-medium text-ink mt-1">Agregar inquilino</h1>
        <p className="text-[13px] text-slate-dark mt-1">
          Sólo el nombre es obligatorio. El DNI, teléfono y correo se pueden completar más tarde.
        </p>
      </div>

      <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Datos del inquilino</h2>
        </div>
        <div className="p-5">
          <EditTenantForm />
        </div>
      </section>
    </>
  )
}
