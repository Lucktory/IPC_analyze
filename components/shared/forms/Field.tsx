// ============================================================================
// Field — labeled input wrapper used across forms and modals.
//
// Pure presentational: just a label-cap above the children. Use any input
// you like as the child. Lives in `components/shared/forms/` so any form
// (contract modal, property edit page, future ones) reuses the same look.
// ============================================================================

import type { ReactNode } from 'react'

interface Props {
  label:    string
  children: ReactNode
}

export function Field({ label, children }: Props) {
  return (
    <label className="block">
      <span className="label-cap block mb-1">{label}</span>
      {children}
    </label>
  )
}
