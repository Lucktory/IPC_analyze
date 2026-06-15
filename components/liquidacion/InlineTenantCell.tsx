'use client'

// ============================================================================
// InlineTenantCell — client wrapper that binds the contractId into the
// server-action callbacks for InlineEntityCell. Mirrors InlineLandlordCell.
// ============================================================================

import { InlineEntityCell, type EntityOption } from './InlineEntityCell'
import type { NewEntityFields } from './NewEntityModal'
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
      entityType="tenant"
      hint={hint}
      displayClassName="text-ink font-medium"
      onPickExisting={(tenantId) =>
        setContractPrimaryTenant(contractId, { kind: 'existing', tenantId })
      }
      onCreateNew={(fields: NewEntityFields) => {
        if (fields.kind !== 'tenant') {
          return Promise.resolve({ ok: false, error: 'Tipo inválido para inquilino.' })
        }
        return setContractPrimaryTenant(contractId, {
          kind:  'new',
          name:  fields.name,
          dni:   fields.dni   || null,
          phone: fields.phone || null,
          email: fields.email || null,
        })
      }}
    />
  )
}
