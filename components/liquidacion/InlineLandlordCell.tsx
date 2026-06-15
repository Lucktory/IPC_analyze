'use client'

// ============================================================================
// InlineLandlordCell — client wrapper that binds the contractId into the
// server-action callbacks for InlineEntityCell. The grid (a server component)
// can't build the closures itself across the RSC boundary, so this thin
// wrapper does the binding on the client.
// ============================================================================

import { InlineEntityCell, type EntityOption } from './InlineEntityCell'
import type { NewEntityFields } from './NewEntityModal'
import { setContractPrimaryLandlord } from '@/lib/contract/junction-actions'

interface Props {
  contractId:  string
  currentName: string
  options:     EntityOption[]
  hint?:       string
}

export function InlineLandlordCell({ contractId, currentName, options, hint }: Props) {
  return (
    <InlineEntityCell
      currentName={currentName}
      options={options}
      entityLabel="propietario"
      entityType="landlord"
      hint={hint}
      displayClassName="text-slate-dark"
      onPickExisting={(landlordId) =>
        setContractPrimaryLandlord(contractId, { kind: 'existing', landlordId })
      }
      onCreateNew={(fields: NewEntityFields) => {
        if (fields.kind !== 'landlord') {
          return Promise.resolve({ ok: false, error: 'Tipo inválido para propietario.' })
        }
        return setContractPrimaryLandlord(contractId, {
          kind:      'new',
          name:      fields.name,
          dniOrCuit: fields.dniOrCuit || null,
          phone:     fields.phone     || null,
          email:     fields.email     || null,
          notes:     fields.notes     || null,
        })
      }}
    />
  )
}
