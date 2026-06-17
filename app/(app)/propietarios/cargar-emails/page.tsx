// ============================================================================
// /propietarios/cargar-emails — bulk-import landlord emails from a pasted
// list (Alejandro's WhatsApp/email format: NAME + EMAIL per line).
//
// Server component: just renders the BulkEmailImporter client wrapper.
// All parse / match / apply logic runs through the two server actions in
// lib/landlord/email-import.ts.
// ============================================================================

import Link from 'next/link'
import { BulkEmailImporter } from '@/components/landlord/BulkEmailImporter'

export const dynamic = 'force-dynamic'

export default function CargarEmailsPage() {
  return (
    <>
      <div className="mb-6">
        <Link
          href="/propietarios"
          className="text-[12px] text-slate hover:text-ink transition-colors inline-flex items-center gap-1"
        >
          ← Volver a propietarios
        </Link>
      </div>

      <div className="mb-6">
        <p className="label-cap text-slate">Propietarios</p>
        <h1 className="font-display text-[22px] font-medium text-ink mt-1">
          Cargar emails en lote
        </h1>
        <p className="text-[13px] text-slate-dark mt-1">
          Pegá la lista de Alejandro (nombre + email por línea). El sistema busca
          coincidencias en la base, te muestra una vista previa y aplicás lo que
          esté correcto. Acepta una o dos direcciones por propietario.
        </p>
      </div>

      <BulkEmailImporter />
    </>
  )
}
