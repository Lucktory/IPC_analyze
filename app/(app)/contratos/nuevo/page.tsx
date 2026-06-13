import Link from 'next/link'
import { BreadcrumbTitle } from '@/components/shell/BreadcrumbContext'
import { createSupabaseServer } from '@/lib/supabase/server'
import { NewContractForm } from '@/components/contract/NewContractForm'

export default async function NewContractPage() {
  const supabase = await createSupabaseServer()

  const [tenantsRes, landlordsRes, propertiesRes] = await Promise.all([
    supabase.from('tenants').select('id, name').order('name'),
    supabase.from('landlords').select('id, name').order('name'),
    supabase.from('properties').select('id, address, property_type').order('address'),
  ])

  const tenants    = ((tenantsRes.data    ?? []) as any[]).map(t => ({ id: t.id as string, label: t.name as string }))
  const landlords  = ((landlordsRes.data  ?? []) as any[]).map(l => ({ id: l.id as string, label: l.name as string }))
  const properties = ((propertiesRes.data ?? []) as any[]).map(p => ({
    id:    p.id as string,
    label: `${p.address} · ${p.property_type ?? '—'}`,
  }))

  const missing: string[] = []
  if (tenants.length    === 0) missing.push('inquilinos')
  if (landlords.length  === 0) missing.push('propietarios')
  if (properties.length === 0) missing.push('propiedades')

  return (
    <>
      <BreadcrumbTitle name="Nuevo contrato" />

      <div className="mb-6">
        <Link href="/contratos" className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1">
          ← Volver a contratos
        </Link>
      </div>

      <div className="mb-6">
        <p className="label-cap text-slate">Nuevo contrato</p>
        <h1 className="font-display text-[22px] font-medium text-ink mt-1">Onboarding de contrato</h1>
        <p className="text-[13px] text-slate-dark mt-1">
          Crea un contrato activo con un inquilino y un propietario principales. Co-propietarios y co-inquilinos se agregan después desde el detalle.
        </p>
      </div>

      {missing.length > 0 && (
        <section className="bg-warn/10 border border-warn/30 rounded p-4 mb-6">
          <p className="text-[13px] text-ink">
            Antes de crear un contrato necesitás cargar al menos un{missing.length > 1 ? 'os' : ''} {missing.join(', ')}.
          </p>
          <p className="text-[12px] text-slate mt-1">
            Tip: podés crearlos desde las páginas de
            {missing.includes('inquilinos')   && <> <Link href="/inquilinos/nuevo"   className="text-ink hover:underline">inquilinos</Link>,</>}
            {missing.includes('propietarios') && <> <Link href="/propietarios/nuevo" className="text-ink hover:underline">propietarios</Link>,</>}
            {missing.includes('propiedades')  && <> <Link href="/propiedades/nuevo"  className="text-ink hover:underline">propiedades</Link></>}
            .
          </p>
        </section>
      )}

      <section className="bg-paper border border-line rounded shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-display text-[15px] font-medium text-ink">Datos del contrato</h2>
          <p className="text-[12px] text-slate mt-0.5">
            La fecha de fin es estimada (3 años por defecto) — se puede ajustar después.
          </p>
        </div>
        <div className="p-5">
          <NewContractForm
            tenants={tenants}
            landlords={landlords}
            properties={properties}
          />
        </div>
      </section>
    </>
  )
}
