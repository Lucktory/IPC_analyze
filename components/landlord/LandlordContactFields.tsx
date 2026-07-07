'use client'

// Inline-editable contact fields for the Propietario detail page's
// "Datos de contacto" card. Email / Teléfono / CUIT edit in place; the
// closures over updateLandlordField live here (client) so the server page
// doesn't have to cross the RSC boundary with a function.

import { InlineTextField } from '@/components/ui/InlineTextField'
import { updateLandlordField } from '@/lib/landlord/actions'

interface Props {
  landlordId:     string
  email:          string | null
  phone:          string | null
  cuit:           string | null
  altEmails:      string[]
  condicionLabel: string
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-slate">{k}</dt>
      <dd className="text-ink mt-0.5 break-words">{children}</dd>
    </div>
  )
}

export function LandlordContactFields({ landlordId, email, phone, cuit, altEmails, condicionLabel }: Props) {
  return (
    <dl className="space-y-2.5 text-[12px]">
      <Row k="Email">
        <InlineTextField
          value={email}
          type="email"
          placeholder="propietario@dominio.com"
          onSave={(v) => updateLandlordField(landlordId, 'email', v)}
        />
      </Row>
      {altEmails.length > 0 && <Row k="Emails alternativos">{altEmails.join(', ')}</Row>}
      <Row k="Teléfono">
        <InlineTextField
          value={phone}
          type="tel"
          placeholder="+54 9 11 1234 5678"
          displayClassName="text-ink tabular-nums"
          onSave={(v) => updateLandlordField(landlordId, 'phone', v)}
        />
      </Row>
      <Row k="CUIT">
        <InlineTextField
          value={cuit}
          placeholder="20-12345678-9"
          displayClassName="text-ink tabular-nums"
          onSave={(v) => updateLandlordField(landlordId, 'cuit', v)}
        />
      </Row>
      <Row k="Condición">{condicionLabel}</Row>
    </dl>
  )
}
