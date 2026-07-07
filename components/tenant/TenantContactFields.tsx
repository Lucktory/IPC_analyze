'use client'

// Inline-editable contact fields for the Inquilino detail page's
// "Datos de contacto" card — DNI / Teléfono / Email edit in place.

import { InlineTextField } from '@/components/ui/InlineTextField'
import { updateTenantField } from '@/lib/tenant/actions'

interface Props {
  tenantId: string
  dni:      string | null
  phone:    string | null
  email:    string | null
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-slate">{k}</dt>
      <dd className="text-ink mt-0.5 break-words">{children}</dd>
    </div>
  )
}

export function TenantContactFields({ tenantId, dni, phone, email }: Props) {
  return (
    <dl className="space-y-2.5 text-[12px]">
      <Row k="DNI">
        <InlineTextField
          value={dni}
          placeholder="DNI / CUIT"
          displayClassName="text-ink tabular-nums"
          onSave={(v) => updateTenantField(tenantId, 'dni', v)}
        />
      </Row>
      <Row k="Teléfono">
        <InlineTextField
          value={phone}
          type="tel"
          placeholder="+54 9 11 1234 5678"
          displayClassName="text-ink tabular-nums"
          onSave={(v) => updateTenantField(tenantId, 'phone', v)}
        />
      </Row>
      <Row k="Email">
        <InlineTextField
          value={email}
          type="email"
          placeholder="inquilino@dominio.com"
          onSave={(v) => updateTenantField(tenantId, 'email', v)}
        />
      </Row>
    </dl>
  )
}
