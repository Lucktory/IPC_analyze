'use client'

// ============================================================================
// InlineTenantCell — client wrapper that binds the contractId into the
// server-action callbacks for InlineEntityCell. Mirrors InlineLandlordCell.
// ============================================================================

import { InlineEntityCell, type EntityOption } from './InlineEntityCell'
import { setContractPrimaryTenant } from '@/lib/contract/junction-actions'

interface Props {
  contractId:  string
  currentName: string
  options:     EntityOption[]
  hint?:       string
}

export function InlineTenantCell({ contractId, currentName, options, hint }: Props) {
  return (
    <InlineEntityCell
      currentName={currentName}
      options={options}
      entityLabel="inquilino"
      hint={hint}
      displayClassName="text-ink font-medium"
      onPickExisting={(tenantId) =>
        setContractPrimaryTenant(contractId, { kind: 'existing', tenantId })
      }
      onCreateNew={(name) =>
        setContractPrimaryTenant(contractId, { kind: 'new', name })
      }
    />
  )
}
