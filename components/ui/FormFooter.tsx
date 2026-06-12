// ============================================================================
// FormFooter + SavedIndicator — the bottom row of every Edit*Form:
//   - Left:  status caption ("Guardado HH:MM" / hint text)
//   - Right: DelayedActionButton(s) (Eliminar + Guardar)
// Replaces the wrapper div + caption that were duplicated across 5 forms.
// ============================================================================

import type { ReactNode } from 'react'
import { fmtTime } from '@/lib/format'

/** Standard hint shown when no save has happened yet. */
export const DELAYED_HINT = 'Los cambios se ejecutan 10s después de confirmar. Tocá el botón armado para cancelar.'

/** Variant for create-mode forms (different wording, same intent). */
export const DELAYED_HINT_CREATE = 'Completá los datos y confirmá. La acción se ejecuta 10s después. Tocá el botón armado para cancelar.'

/**
 * Wraps the footer row. Inside, render `<SavedIndicator>` on the left and
 * a `<div className="flex items-center gap-2">…buttons…</div>` on the right.
 */
export function FormFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sm:col-span-2 flex items-center justify-between pt-2 flex-wrap gap-3">
      {children}
    </div>
  )
}

interface SavedIndicatorProps {
  /** When non-null, renders a green "✓ Guardado HH:MM". Otherwise renders `idleHint`. */
  savedAt:  Date | null
  idleHint?: string
}

export function SavedIndicator({ savedAt, idleHint = DELAYED_HINT }: SavedIndicatorProps) {
  return (
    <p className="text-[12px] text-slate">
      {savedAt
        ? <span className="text-success">✓ Guardado {fmtTime(savedAt)}</span>
        : idleHint}
    </p>
  )
}
