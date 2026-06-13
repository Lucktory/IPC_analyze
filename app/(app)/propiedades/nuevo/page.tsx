import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { EditPropertyForm } from '@/components/property/EditPropertyForm'

export default function NewPropertyPage() {
  return (
    <>
      <BreadcrumbTitle name="Nueva propiedad" />

      <div className="mb-6">
        <Link href="/propiedades" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          ← Volver a propiedades
        </Link>
      </div>

      <div className="mb-6">
        <p className="label-cap text-slate">Nueva propiedad</p>
        <h1 className="font-display text-[22px] font-medium text-ink mt-1">Agregar propiedad</h1>
        <p className="text-[13px] text-slate-dark mt-1">
          Dirección y tipo bastan para crearla. La asignación de propietario se hace después desde el detalle.
        </p>
      </div>

      <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Datos de la propiedad</h2>
        </div>
        <div className="p-5">
          <EditPropertyForm />
        </div>
      </section>
    </>
  )
}
