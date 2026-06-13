import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { EditLandlordForm } from '@/components/landlord/EditLandlordForm'

export default function NewLandlordPage() {
  return (
    <>
      <BreadcrumbTitle name="Nuevo propietario" />

      <div className="mb-6">
        <Link href="/propietarios" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          ← Volver a propietarios
        </Link>
      </div>

      <div className="mb-6">
        <p className="label-cap text-slate">Nuevo propietario</p>
        <h1 className="font-display text-[22px] font-medium text-ink mt-1">Agregar propietario</h1>
        <p className="text-[13px] text-slate-dark mt-1">
          Sólo el nombre es obligatorio. El CUIT/DNI, teléfono, correo y notas se pueden completar más tarde.
        </p>
      </div>

      <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Datos del propietario</h2>
        </div>
        <div className="p-5">
          <EditLandlordForm />
        </div>
      </section>
    </>
  )
}
