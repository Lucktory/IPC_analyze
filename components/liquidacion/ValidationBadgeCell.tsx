'use client'

// ============================================================================
// ValidationBadgeCell — column 21 indicator (Phase 7A).
//
// Renders a small badge based on the row's validationIssues:
//   • zero issues          → muted green ✓
//   • only warnings        → yellow ⚠ N (count)
//   • at least one error   → red ⚠ N
//
// Click → popover (portal-rendered to escape the grid's overflow context)
// listing every issue with severity dot, message, expected vs actual.
// ============================================================================

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingPopover } from './useFloatingPopover'
import { highestSeverity, type ValidationIssue } from '@/lib/liquidacion/validations'
import { ValidationIssueRow } from '@/components/shared/ValidationIssueRow'

interface Props {
  issues: ValidationIssue[]
}

export function ValidationBadgeCell({ issues }: Props) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const rect = useFloatingPopover({ open, anchor: buttonRef.current, minWidth: 380 })

  const severity = highestSeverity(issues)
  const count    = issues.length

  // Visual: tiered styles based on severity.
  const styles =
    severity === 'error'   ? { dot: 'bg-danger',  text: 'text-danger',  bg: 'hover:bg-danger/10' } :
    severity === 'warning' ? { dot: 'bg-warn',    text: 'text-ink',     bg: 'hover:bg-warn/10'   } :
                             { dot: 'bg-success/70', text: 'text-success', bg: 'hover:bg-success/10' }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-editing={open ? '' : undefined}
        onClick={() => count > 0 && setOpen(true)}
        title={count === 0 ? 'Todos los chequeos pasaron' : `${count} ${count === 1 ? 'problema' : 'problemas'} — tocá para ver`}
        className={`inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded transition-colors ${styles.bg} ${count === 0 ? 'cursor-default' : 'cursor-pointer'}`}
        disabled={count === 0}
      >
        {count === 0 ? (
          <span className={`text-[12px] ${styles.text}`}>✓</span>
        ) : (
          <>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${styles.dot}`} />
            <span className={`text-[10px] font-medium ${styles.text}`}>{count}</span>
          </>
        )}
      </button>

      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />
          <div
            style={{ position: 'absolute', top: rect.top, left: rect.left, width: rect.width, zIndex: 1000 }}
            className="bg-white border border-gray-300 rounded shadow-lg"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-display text-[13px] font-medium text-ink">
                {count} {count === 1 ? 'discrepancia detectada' : 'discrepancias detectadas'}
              </span>
              <span className="text-[10px] text-gray-500 italic">click afuera para cerrar</span>
            </div>
            <ul className="max-h-[360px] overflow-y-auto">
              {issues.map((issue, idx) => (
                <ValidationIssueRow key={`${issue.code}-${idx}`} issue={issue} />
              ))}
            </ul>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

// Rule-code → Spanish label map lives in components/shared/ValidationIssueRow.tsx
// (see `prettyValidationCode`) so /diagnostico, the contract page, and this
// badge's popover all render labels from one source.
