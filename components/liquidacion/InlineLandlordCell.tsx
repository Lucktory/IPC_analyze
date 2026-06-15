'use client'

// ============================================================================
// InlineLandlordCell — client wrapper that binds the contractId into the
// server-action callbacks for InlineEntityCell. The grid (a server component)
// can't build the closures itself across the RSC boundary, so this thin
// wrapper does the binding on the client.
// ============================================================================

import { InlineEntityCell, type EntityOption } from './InlineEntityCell'
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
      hint={hint}
      displayClassName="text-slate-dark"
      onPickExisting={(landlordId) =>
        setContractPrimaryLandlord(contractId, { kind: 'existing', landlordId })
      }
      onCreateNew={(name) =>
        setContractPrimaryLandlord(contractId, { kind: 'new', name })
      }
    />
  )
}
